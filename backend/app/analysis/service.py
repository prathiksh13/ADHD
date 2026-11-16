from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from datetime import UTC, datetime

from app.analysis.schemas import (
    ActivityInput,
    BlockProgressionInput,
    ConcordanceProfile,
    DistractionBreakdown,
    DurationBand,
    EegArtifactAnalysis,
    ExecutiveSummary,
    FlaggedEpochWindow,
    OffScreenEpisodeInput,
    PairwiseAlignment,
    Recommendation,
    RootCauseBreakdown,
    SessionAnalysisRequest,
    SessionAnalysisResponse,
    TimeSeriesPoint,
    WebcamInput,
)

ANALYSIS_VERSION = "attune-cross-modal-v1"
BLINK_ARTIFACT_WINDOW_MS = 250
ALERT_ARTIFACT_WINDOW_MS = 1_500
BLINK_DISTRACTION_PROXIMITY_MS = 2_000

AffectInterval = tuple[int, int, str]
EpisodeDetail = tuple[int, int, OffScreenEpisodeInput]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _round(value: float, digits: int = 1) -> float:
    return round(float(value), digits)


def _episode_end(episode: OffScreenEpisodeInput) -> int:
    if episode.end_ms is not None:
        return episode.end_ms
    return episode.start_ms + (episode.duration_ms or 0)


def _session_duration_ms(payload: SessionAnalysisRequest) -> int:
    supplied = payload.session_duration_ms or payload.webcam.session_duration_ms
    if supplied:
        return supplied
    if payload.started_at is not None and payload.completed_at is not None:
        derived = int((payload.completed_at - payload.started_at).total_seconds() * 1000)
        if derived > 0:
            return derived

    timestamps = [
        *payload.eeg_epoch_timestamps_ms,
        *payload.eeg.epoch_timestamps_ms,
        *payload.webcam.blink_timestamps_ms,
        *payload.webcam.alert_timestamps_ms,
        *(point.elapsed_ms for point in payload.webcam.emotion_timeline),
        *(_episode_end(item) for item in payload.webcam.off_screen_episodes),
    ]
    return max(1, max(timestamps, default=60_000))


def _reaction_time_cv(activity: ActivityInput) -> float | None:
    if activity.reaction_time_cv is not None:
        return activity.reaction_time_cv
    if activity.rt_variability_sd_ms is not None and activity.mean_rt_ms:
        return activity.rt_variability_sd_ms / activity.mean_rt_ms
    return None


def _block_accuracies(activity: ActivityInput) -> list[float]:
    if activity.block_progression:
        return [
            item.accuracy_pct if isinstance(item, BlockProgressionInput) else item
            for item in activity.block_progression
        ]
    return activity.block_accuracy_percent


def _blink_rate_per_min(webcam: WebcamInput, duration_ms: int) -> float:
    if webcam.blink_timestamps_ms:
        return len(webcam.blink_timestamps_ms) / (duration_ms / 60_000)
    if webcam.blink_rate_per_min is not None:
        return webcam.blink_rate_per_min
    if webcam.total_blinks:
        return webcam.total_blinks / (duration_ms / 60_000)
    return 0.0


def _eeg_risk_level(probability: float) -> str:
    if probability < 0.35:
        return "Low"
    if probability < 0.65:
        return "Moderate"
    return "Elevated"


def _webcam_attention_level(focus_percentage: float) -> str:
    if focus_percentage >= 80:
        return "High"
    if focus_percentage >= 60:
        return "Moderate"
    return "Fragmented"


def _error_rate(activity: ActivityInput) -> float | None:
    if activity.total_trials is None:
        return None
    return (activity.commission_errors + activity.omission_errors) / activity.total_trials


def _task_performance_level(activity: ActivityInput) -> str:
    error_rate = _error_rate(activity)
    cv = _reaction_time_cv(activity)
    if activity.accuracy_pct is None and cv is None and activity.total_trials is None:
        return "Insufficient"

    accuracy = activity.accuracy_pct
    if (
        (accuracy is not None and accuracy < 60)
        or (cv is not None and cv > 0.45)
        or (error_rate is not None and error_rate > 0.35)
    ):
        return "Weak"
    if (
        (accuracy is not None and accuracy >= 80)
        and (cv is None or cv <= 0.25)
        and (error_rate is None or error_rate <= 0.15)
    ):
        return "Strong"
    return "Mixed"


def _risk_score(level: str) -> int | None:
    return {"Low": 0, "Moderate": 1, "Elevated": 2, "High": 0, "Fragmented": 2}.get(level)


def _task_score(level: str) -> int | None:
    return {"Strong": 0, "Mixed": 1, "Weak": 2, "Insufficient": None}[level]


def _phenotype(eeg_level: str, webcam_level: str, task_level: str) -> str:
    eeg_score = _risk_score(eeg_level) or 0
    webcam_score = _risk_score(webcam_level) or 0
    task_score = _task_score(task_level)

    if eeg_score >= 1 and webcam_score >= 1:
        return "convergent-risk"
    if eeg_score >= 1 and (webcam_score == 0 or task_score == 0):
        return "compensatory-control"
    if eeg_score == 0 and (webcam_score >= 1 or (task_score is not None and task_score >= 1)):
        return "behavioral-fragmentation"
    return "regulated-attention"


def _convergence_level(phenotype: str) -> str:
    return {
        "convergent-risk": "convergent",
        "regulated-attention": "aligned-low-risk",
        "compensatory-control": "discordant",
        "behavioral-fragmentation": "partial",
    }[phenotype]


def _pairwise_alignment(
    eeg_level: str,
    webcam_level: str,
    task_level: str,
) -> list[PairwiseAlignment]:
    eeg_risk = (_risk_score(eeg_level) or 0) >= 1
    webcam_risk = (_risk_score(webcam_level) or 0) >= 1
    task_score = _task_score(task_level)
    task_risk = task_score is not None and task_score >= 1

    def status(left: bool, right: bool) -> str:
        return "aligned" if left == right else "discordant"

    def note(left: str, right: str, same: bool) -> str:
        if same:
            return f"{left} and {right} point in the same direction."
        return f"{left} and {right} do not point in the same direction."

    return [
        PairwiseAlignment(
            modalities=["eeg", "webcam"],
            status=status(eeg_risk, webcam_risk),
            note=note(
                "The EEG risk estimate",
                "the webcam attention pattern",
                eeg_risk == webcam_risk,
            ),
        ),
        PairwiseAlignment(
            modalities=["eeg", "task"],
            status="insufficient" if task_score is None else status(eeg_risk, task_risk),
            note=(
                "Task performance data was insufficient for a comparison."
                if task_score is None
                else note("The EEG risk estimate", "task performance", eeg_risk == task_risk)
            ),
        ),
        PairwiseAlignment(
            modalities=["webcam", "task"],
            status="insufficient" if task_score is None else status(webcam_risk, task_risk),
            note=(
                "Task performance data was insufficient for a comparison."
                if task_score is None
                else note("The webcam attention pattern", "task performance", webcam_risk == task_risk)
            ),
        ),
    ]


def _artifact_analysis(
    epoch_timestamps: Sequence[int],
    blink_timestamps: Sequence[int],
    alert_timestamps: Sequence[int],
) -> EegArtifactAnalysis:
    sources: list[set[str]] = [set() for _ in epoch_timestamps]

    def mark(events: Sequence[int], before_ms: int, after_ms: int, source: str) -> None:
        for event in events:
            first = bisect_left(epoch_timestamps, event - before_ms)
            after = bisect_right(epoch_timestamps, event + after_ms)
            for index in range(first, after):
                sources[index].add(source)

    mark(blink_timestamps, BLINK_ARTIFACT_WINDOW_MS, BLINK_ARTIFACT_WINDOW_MS, "blink")
    mark(alert_timestamps, 0, ALERT_ARTIFACT_WINDOW_MS, "alert")

    blink_epochs = sum("blink" in item for item in sources)
    alert_epochs = sum("alert" in item for item in sources)
    overlapping = sum(item == {"blink", "alert"} for item in sources)
    flagged_epochs = sum(bool(item) for item in sources)
    total_epochs = len(epoch_timestamps)
    clean_epochs = total_epochs - flagged_epochs
    cleanliness = 100.0 * clean_epochs / total_epochs if total_epochs else 0.0
    artifact_percentage = 100.0 - cleanliness

    if cleanliness >= 95:
        quality = "excellent"
    elif cleanliness >= 85:
        quality = "good"
    elif cleanliness >= 70:
        quality = "fair"
    else:
        quality = "poor"

    windows: list[FlaggedEpochWindow] = []
    start: int | None = None
    end: int | None = None
    window_sources: set[str] = set()
    for index, item in enumerate(sources):
        if item:
            if start is None:
                start = index
            end = index
            window_sources.update(item)
        elif start is not None and end is not None:
            windows.append(
                FlaggedEpochWindow(
                    start_epoch_index=start,
                    end_epoch_index=end,
                    start_timestamp_ms=epoch_timestamps[start],
                    end_timestamp_ms=epoch_timestamps[end],
                    sources=sorted(window_sources),
                )
            )
            start = end = None
            window_sources = set()
    if start is not None and end is not None:
        windows.append(
            FlaggedEpochWindow(
                start_epoch_index=start,
                end_epoch_index=end,
                start_timestamp_ms=epoch_timestamps[start],
                end_timestamp_ms=epoch_timestamps[end],
                sources=sorted(window_sources),
            )
        )

    return EegArtifactAnalysis(
        total_epochs=total_epochs,
        blink_artifact_epochs=blink_epochs,
        alert_artifact_epochs=alert_epochs,
        overlapping_artifact_epochs=overlapping,
        flagged_epochs=flagged_epochs,
        clean_epochs=clean_epochs,
        artifact_percentage=_round(artifact_percentage),
        eeg_signal_cleanliness_pct=_round(cleanliness),
        quality_rating=quality,
        flagged_windows=windows,
    )


def _merged_intervals(
    episodes: Sequence[tuple[int, int]],
    duration_ms: int,
) -> list[tuple[int, int]]:
    clean = sorted(
        (max(0, min(start, duration_ms)), max(0, min(end, duration_ms)))
        for start, end in episodes
        if min(end, duration_ms) > max(0, min(start, duration_ms))
    )
    merged: list[tuple[int, int]] = []
    for start, end in clean:
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
        else:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
    return merged


def _off_screen_metrics(
    webcam: WebcamInput, duration_ms: int
) -> tuple[list[tuple[int, int]], int, int, list[EpisodeDetail]]:
    details = sorted(
        (
            max(0, min(item.start_ms, duration_ms)),
            max(0, min(_episode_end(item), duration_ms)),
            item,
        )
        for item in webcam.off_screen_episodes
    )
    details = [(start, end, item) for start, end, item in details if end > start]
    episodes = [(start, end) for start, end, _ in details]
    merged = _merged_intervals(episodes, duration_ms)
    total_duration = sum(end - start for start, end in merged)
    longest = max((end - start for start, end in episodes), default=0)
    if episodes:
        return episodes, total_duration, longest, details
    return [], webcam.total_distraction_duration_ms, webcam.longest_distraction_ms, []


def _affect_intervals(webcam: WebcamInput, duration_ms: int) -> list[AffectInterval]:
    points = sorted(webcam.emotion_timeline, key=lambda point: point.elapsed_ms)
    intervals: list[AffectInterval] = []
    for index, point in enumerate(points):
        start = max(0, min(point.elapsed_ms, duration_ms))
        next_start = points[index + 1].elapsed_ms if index + 1 < len(points) else duration_ms
        end = max(0, min(next_start, duration_ms))
        if end > start:
            intervals.append((start, end, point.state))
    return intervals


def _domain_index(offset_ms: float, block_count: int, duration_ms: int) -> int:
    if block_count <= 0:
        return 0
    return min(block_count - 1, int(max(0.0, offset_ms) / duration_ms * block_count))


def _bucket_affect(
    intervals: Sequence[AffectInterval],
    start: int,
    end: int,
) -> tuple[dict[str, int], str]:
    durations: dict[str, int] = {}
    for left, right, state in intervals:
        overlap = min(end, right) - max(start, left)
        if overlap > 0:
            durations[state] = durations.get(state, 0) + overlap
    if not durations:
        return {}, "Neutral"
    dominant = max(durations, key=lambda state: durations[state])
    return durations, dominant


def _time_series(
    payload: SessionAnalysisRequest,
    duration_ms: int,
    episodes: Sequence[tuple[int, int]],
) -> list[TimeSeriesPoint]:
    webcam = payload.webcam
    activity = payload.activity
    intervals = _affect_intervals(webcam, duration_ms)
    minute_count = max(1, (duration_ms + 59_999) // 60_000)
    merged_episodes = _merged_intervals(episodes, duration_ms)
    blink_timestamps = sorted(webcam.blink_timestamps_ms)
    block_accuracies = _block_accuracies(activity)
    block_count = len(block_accuracies)
    points: list[TimeSeriesPoint] = []

    for minute in range(1, minute_count + 1):
        start = (minute - 1) * 60_000
        if start >= duration_ms:
            break
        end = min(duration_ms, start + 60_000)
        bucket_ms = max(1, end - start)
        if merged_episodes:
            off_screen = sum(max(0, min(end, right) - max(start, left)) for left, right in merged_episodes)
            focus = 100.0 * (1.0 - off_screen / bucket_ms)
        else:
            focus = webcam.focus_percentage

        if blink_timestamps:
            blink_count = sum(start <= stamp < end for stamp in blink_timestamps)
            blink_rate = blink_count / (bucket_ms / 60_000)
        else:
            blink_rate = _blink_rate_per_min(webcam, duration_ms)

        if block_count:
            block_index = _domain_index(end, block_count, duration_ms)
            task_accuracy = block_accuracies[block_index]
        else:
            task_accuracy = activity.accuracy_pct

        affect_durations, dominant = _bucket_affect(intervals, start, end)
        frustration = 100.0 * affect_durations.get("Frustrated", 0) / bucket_ms
        fatigue = 100.0 * affect_durations.get("Fatigued", 0) / bucket_ms

        points.append(
            TimeSeriesPoint(
                minute=minute,
                start_offset_ms=start,
                end_offset_ms=end,
                focus_percentage=_round(_clamp(focus, 0.0, 100.0)),
                blink_rate_per_min=_round(max(0.0, blink_rate)),
                task_accuracy_percentage=None if task_accuracy is None else _round(task_accuracy),
                frustration_index=_round(_clamp(frustration, 0.0, 100.0)),
                fatigue_index=_round(_clamp(fatigue, 0.0, 100.0)),
                dominant_affect=dominant,
            )
        )
    return points


def _affect_at(intervals: Sequence[AffectInterval], offset_ms: int) -> str | None:
    for start, end, state in intervals:
        if start <= offset_ms < end:
            return state
    return None


def _duration_band(duration_ms: int) -> str:
    if duration_ms < 3_000:
        return "brief"
    if duration_ms < 10_000:
        return "moderate"
    return "prolonged"


_CAUSE_ALIASES = {
    "fatigued": "fatigue",
    "fatigue": "fatigue",
    "tired": "fatigue",
    "frustrated": "frustration",
    "frustration": "frustration",
    "blink": "blink",
    "blinks": "blink",
    "unclassified": "unclassified",
}


def _episode_cause(
    item: OffScreenEpisodeInput,
    start: int,
    end: int,
    intervals: Sequence[AffectInterval],
    blink_timestamps: Sequence[int],
) -> str:
    if item.root_cause and item.root_cause.strip():
        cause = item.root_cause.strip().lower()
        return _CAUSE_ALIASES.get(cause, cause)

    affect = _affect_at(intervals, (start + end) // 2)
    if affect == "Fatigued":
        return "fatigue"
    if affect == "Frustrated":
        return "frustration"
    if any(
        start - BLINK_DISTRACTION_PROXIMITY_MS <= stamp <= end + BLINK_DISTRACTION_PROXIMITY_MS
        for stamp in blink_timestamps
    ):
        return "blink"
    return "unclassified"


def _recovery_speed(mean_recovery_latency_ms: float, episode_count: int) -> str:
    if episode_count == 0 or mean_recovery_latency_ms <= 0:
        return "unknown"
    if mean_recovery_latency_ms < 2_000:
        return "fast"
    if mean_recovery_latency_ms < 5_000:
        return "moderate"
    return "slow"


def _distraction_breakdown(
    webcam: WebcamInput,
    duration_ms: int,
    episodes: Sequence[tuple[int, int]],
    total_duration_ms: int,
    longest_ms: int,
    intervals: Sequence[AffectInterval],
    details: Sequence[EpisodeDetail],
) -> DistractionBreakdown:
    bands: dict[str, tuple[int, int]] = {
        "brief": (0, 0),
        "moderate": (0, 0),
        "prolonged": (0, 0),
    }
    fatigue_count = 0
    frustration_count = 0
    blink_count = 0
    unclassified = 0
    recovery_values: list[float] = []
    cause_groups: dict[str, dict[str, object]] = {}
    blink_timestamps = webcam.blink_timestamps_ms

    for start, end, item in details:
        length = end - start
        band = _duration_band(length)
        count, total = bands[band]
        bands[band] = (count + 1, total + length)

        cause = _episode_cause(item, start, end, intervals, blink_timestamps)
        if cause == "fatigue":
            fatigue_count += 1
        elif cause == "frustration":
            frustration_count += 1
        elif cause == "blink":
            blink_count += 1
        else:
            unclassified += 1

        group = cause_groups.setdefault(cause, {"count": 0, "total": 0, "recovery": []})
        group["count"] = int(group["count"]) + 1
        group["total"] = int(group["total"]) + length
        if item.recovery_latency_ms is not None:
            recovery_values.append(item.recovery_latency_ms)
            recoveries = group["recovery"]
            assert isinstance(recoveries, list)
            recoveries.append(item.recovery_latency_ms)

    if not episodes and total_duration_ms == 0:
        severity = "minimal"
    else:
        ratio = total_duration_ms / duration_ms
        if ratio < 0.03 and longest_ms < 3_000:
            severity = "brief"
        elif ratio < 0.12 and longest_ms < 10_000:
            severity = "intermittent"
        else:
            severity = "sustained"

    episode_count = len(episodes)
    mean_recovery = (
        sum(recovery_values) / len(recovery_values) if recovery_values else webcam.avg_recovery_latency_ms
    )
    by_root_cause: list[RootCauseBreakdown] = []
    for cause, group in cause_groups.items():
        recoveries = group["recovery"]
        assert isinstance(recoveries, list)
        by_root_cause.append(
            RootCauseBreakdown(
                root_cause=cause,
                count=int(group["count"]),
                total_duration_ms=int(group["total"]),
                mean_recovery_latency_ms=(_round(sum(recoveries) / len(recoveries)) if recoveries else 0.0),
            )
        )
    by_root_cause.sort(key=lambda item: (-item.count, -item.total_duration_ms, item.root_cause))

    interpretation = (
        f"{episode_count} off-screen episode(s) accounted for "
        f"{_round(100.0 * total_duration_ms / duration_ms)}% of the session."
    )
    if fatigue_count:
        interpretation += f" {fatigue_count} were fatigue-associated."
    if frustration_count:
        interpretation += f" {frustration_count} were frustration-associated."
    if by_root_cause:
        interpretation += f" Most frequent root cause: {by_root_cause[0].root_cause}."
    if mean_recovery:
        interpretation += f" Mean recovery latency was {_round(mean_recovery)} ms."

    return DistractionBreakdown(
        total_distractions=max(webcam.distraction_count, episode_count),
        off_screen_episode_count=episode_count,
        total_off_screen_duration_ms=total_duration_ms,
        longest_off_screen_duration_ms=longest_ms,
        mean_recovery_latency_ms=_round(mean_recovery),
        recovery_speed=_recovery_speed(mean_recovery, episode_count),
        blink_associated_count=blink_count,
        fatigue_associated_count=fatigue_count,
        frustration_associated_count=frustration_count,
        unclassified_count=unclassified,
        severity=severity,
        by_root_cause=by_root_cause,
        by_duration_band=[
            DurationBand(band=band, count=count, total_duration_ms=total)
            for band, (count, total) in bands.items()
        ],
        interpretation=interpretation,
    )


def _concordance_profile(
    eeg_level: str,
    webcam_level: str,
    task_level: str,
    phenotype: str,
) -> ConcordanceProfile:
    interpretations = {
        "regulated-attention": (
            "EEG risk, webcam attention and task behavior are broadly consistent with a "
            "regulated attention profile."
        ),
        "compensatory-control": (
            "The EEG estimate suggests elevated risk while webcam attention or task behavior "
            "remains comparatively preserved, consistent with compensation or context effects."
        ),
        "behavioral-fragmentation": (
            "Behavioral attention signals are fragmented even though the EEG estimate is lower, "
            "which may reflect task design, environment, fatigue or state effects."
        ),
        "convergent-risk": (
            "EEG risk and behavioral attention signals converge, which is the strongest "
            "cross-modal pattern in this analysis but still not a diagnosis."
        ),
    }
    return ConcordanceProfile(
        eeg_risk_level=eeg_level,
        webcam_attention_level=webcam_level,
        task_performance_level=task_level,
        convergence_level=_convergence_level(phenotype),
        phenotype=phenotype,
        interpretation=interpretations[phenotype],
        pairwise_alignment=_pairwise_alignment(eeg_level, webcam_level, task_level),
    )


def _executive_summary(
    payload: SessionAnalysisRequest,
    phenotype: str,
    eeg_level: str,
    webcam_level: str,
    task_level: str,
    artifacts: EegArtifactAnalysis,
    distractions: DistractionBreakdown,
) -> ExecutiveSummary:
    overall_risk = {
        "regulated-attention": "Low",
        "compensatory-control": "Moderate",
        "behavioral-fragmentation": "Moderate",
        "convergent-risk": "Elevated",
    }[phenotype]
    headlines = {
        "regulated-attention": "Attention signals are broadly regulated",
        "compensatory-control": "Behavioral performance is compensating for EEG risk",
        "behavioral-fragmentation": "Behavioral attention is fragmented despite lower EEG risk",
        "convergent-risk": "Multiple attention signals converge at elevated risk",
    }
    accuracy = (
        "not available"
        if payload.activity.accuracy_pct is None
        else f"{_round(payload.activity.accuracy_pct)}%"
    )
    narrative = (
        f"The EEG estimate is {eeg_level.lower()} risk at "
        f"{_round(payload.eeg.adhd_probability * 100)}% probability. Webcam attention is "
        f"{webcam_level.lower()} with {_round(payload.webcam.focus_percentage)}% focus, and "
        f"task performance is {task_level.lower()} with accuracy {accuracy}. The combined "
        f"pattern is labeled {phenotype}. This is a descriptive research summary, not a diagnosis."
    )
    key_findings = [
        (
            f"EEG quality: {artifacts.eeg_signal_cleanliness_pct}% of epochs were clean "
            f"({artifacts.quality_rating})."
        ),
        (
            f"Webcam attention: {payload.webcam.focus_percentage}% focus and "
            f"{distractions.total_distractions} distraction(s)."
        ),
        (f"Task behavior: {task_level.lower()} performance with {accuracy} accuracy."),
    ]
    if payload.eeg.top_shap_features:
        top = sorted(payload.eeg.top_shap_features, key=lambda item: abs(item.impact), reverse=True)[0]
        key_findings.append(f"Largest reported EEG feature contribution: {top.feature} ({top.impact:+.3f}).")
    biomarker_parts: list[str] = []
    if isinstance(payload.eeg.theta_beta_ratio, dict) and payload.eeg.theta_beta_ratio:
        ratios = ", ".join(
            f"{region} {value:.2f}" for region, value in list(payload.eeg.theta_beta_ratio.items())[:4]
        )
        biomarker_parts.append(f"theta/beta ratio {ratios}")
    elif isinstance(payload.eeg.theta_beta_ratio, float):
        biomarker_parts.append(f"theta/beta ratio {payload.eeg.theta_beta_ratio:.2f}")
    if payload.eeg.frontal_alpha_asymmetry is not None:
        biomarker_parts.append(f"frontal alpha asymmetry {payload.eeg.frontal_alpha_asymmetry:+.2f}")
    if payload.eeg.spectral_entropy is not None:
        biomarker_parts.append(f"spectral entropy {payload.eeg.spectral_entropy:.2f}")
    if biomarker_parts:
        key_findings.append(f"Reported EEG biomarkers: {'; '.join(biomarker_parts)}.")

    limitations = [
        "Model probabilities and phenotype labels are research/support information, not an ADHD diagnosis.",
        "Webcam attention is derived from head pose, eye and expression signals and can be affected by lighting, glasses and posture.",
        "This single-session summary does not establish clinical validity or predict treatment response.",
    ]
    if artifacts.total_epochs == 0:
        limitations.append(
            "No EEG epoch timestamps were supplied, so artifact cleanliness could not be estimated."
        )
    if artifacts.quality_rating in {"fair", "poor"}:
        limitations.append(
            "EEG artifacts may have influenced the model estimate; repeat under quieter conditions."
        )

    return ExecutiveSummary(
        headline=headlines[phenotype],
        narrative=narrative,
        overall_risk_level=overall_risk,
        phenotype=phenotype,
        key_findings=key_findings,
        limitations=limitations,
    )


def _recommendations(
    payload: SessionAnalysisRequest,
    phenotype: str,
    artifacts: EegArtifactAnalysis,
    distractions: DistractionBreakdown,
    series: Sequence[TimeSeriesPoint],
) -> list[Recommendation]:
    recommendations: list[Recommendation] = []
    max_fatigue = max((point.fatigue_index for point in series), default=0.0)
    max_frustration = max((point.frustration_index for point in series), default=0.0)
    max_blink_rate = max((point.blink_rate_per_min for point in series), default=0.0)

    if artifacts.quality_rating in {"fair", "poor"}:
        recommendations.append(
            Recommendation(
                category="data-quality",
                title="Repeat EEG under quieter conditions",
                detail=(
                    "Signal artifacts reduced EEG cleanliness. Minimize movement and blinks, "
                    "check electrode contact, and repeat the recording before comparing sessions."
                ),
                priority="high",
            )
        )
    if phenotype == "convergent-risk":
        recommendations.append(
            Recommendation(
                category="clinical-discussion",
                title="Discuss the convergent pattern with a qualified professional",
                detail=(
                    "EEG and behavioral signals point in the same direction. Share the session context "
                    "with a qualified clinician, while treating this result as research information rather "
                    "than a diagnosis."
                ),
                priority="high",
            )
        )
    elif phenotype in {"compensatory-control", "behavioral-fragmentation"}:
        recommendations.append(
            Recommendation(
                category="monitoring",
                title="Compare this session with repeated measurements",
                detail=(
                    "The modalities do not fully agree. Repeat the activity in similar conditions and "
                    "compare trends across several sessions before drawing conclusions."
                ),
                priority="medium",
            )
        )

    if payload.webcam.focus_percentage < 60:
        recommendations.append(
            Recommendation(
                category="attention-environment",
                title="Reduce competing visual and auditory prompts",
                detail=(
                    "Focus was fragmented. Use a quieter workspace, keep only task materials visible, "
                    "and consider a short visual timer with a defined break point."
                ),
                priority="high",
            )
        )
    if distractions.severity in {"intermittent", "sustained"}:
        recommendations.append(
            Recommendation(
                category="task-design",
                title="Shorten the work interval",
                detail=(
                    "Off-screen time was sustained or repeated. Try a shorter task block, a clear "
                    "completion cue and a brief movement break before the next block."
                ),
                priority="medium",
            )
        )
    if max_fatigue >= 20 or max_blink_rate >= 25:
        recommendations.append(
            Recommendation(
                category="rest-and-regulation",
                title="Plan an eye and movement break",
                detail=(
                    "Fatigue signals or blink rate were elevated. Schedule a short rest, hydration and "
                    "a screen break, and check whether sleep or medication timing may be relevant."
                ),
                priority="medium",
            )
        )
    if max_frustration >= 20:
        recommendations.append(
            Recommendation(
                category="task-design",
                title="Add choice and scaffolded difficulty",
                detail=(
                    "Frustration increased during the session. Offer a choice of order, provide one "
                    "worked example, and split the task into smaller achievable steps."
                ),
                priority="medium",
            )
        )
    if payload.activity.accuracy_pct is not None and payload.activity.accuracy_pct < 70:
        recommendations.append(
            Recommendation(
                category="task-design",
                title="Use practice trials before scored blocks",
                detail=(
                    "Task accuracy was below the configured reference. Review instructions, run a "
                    "short practice block and reduce time pressure before retesting."
                ),
                priority="medium",
            )
        )
    if payload.webcam.face_visible_percentage < 80:
        recommendations.append(
            Recommendation(
                category="data-quality",
                title="Improve camera framing for the next session",
                detail=(
                    "The face was not visible for part of the session. Center the camera, improve "
                    "lighting and avoid backlighting so attention telemetry is more complete."
                ),
                priority="medium",
            )
        )
    if not recommendations:
        recommendations.append(
            Recommendation(
                category="monitoring",
                title="Continue current supports and monitor trends",
                detail=(
                    "No strong cross-modal concern was detected. Keep the current routine and compare "
                    "future sessions under similar conditions."
                ),
                priority="low",
            )
        )
    return recommendations


def analyze_session(payload: SessionAnalysisRequest) -> SessionAnalysisResponse:
    duration_ms = _session_duration_ms(payload)
    epoch_timestamps = payload.eeg_epoch_timestamps_ms or payload.eeg.epoch_timestamps_ms
    artifacts = _artifact_analysis(
        epoch_timestamps,
        payload.webcam.blink_timestamps_ms,
        payload.webcam.alert_timestamps_ms,
    )
    eeg_level = _eeg_risk_level(payload.eeg.adhd_probability)
    webcam_level = _webcam_attention_level(payload.webcam.focus_percentage)
    task_level = _task_performance_level(payload.activity)
    phenotype = _phenotype(eeg_level, webcam_level, task_level)
    concordance = _concordance_profile(eeg_level, webcam_level, task_level, phenotype)

    episodes, off_screen_duration, longest, details = _off_screen_metrics(payload.webcam, duration_ms)
    intervals = _affect_intervals(payload.webcam, duration_ms)
    distractions = _distraction_breakdown(
        payload.webcam,
        duration_ms,
        episodes,
        off_screen_duration,
        longest,
        intervals,
        details,
    )
    series = _time_series(payload, duration_ms, episodes)
    executive = _executive_summary(
        payload,
        phenotype,
        eeg_level,
        webcam_level,
        task_level,
        artifacts,
        distractions,
    )

    return SessionAnalysisResponse(
        session_id=payload.session_id,
        activity_type=payload.activity_type or payload.activity.task_type or "unknown",
        generated_at=datetime.now(UTC),
        analysis_version=ANALYSIS_VERSION,
        executive_summary=executive,
        eeg_artifact_analysis=artifacts,
        concordance_profile=concordance,
        time_series_overlay=series,
        distraction_breakdown=distractions,
        personalized_recommendations=_recommendations(
            payload,
            phenotype,
            artifacts,
            distractions,
            series,
        ),
    )
