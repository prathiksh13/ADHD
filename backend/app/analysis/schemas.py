from __future__ import annotations

import math
from datetime import datetime
from itertools import pairwise
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, field_validator, model_validator

from app.schemas import ApiModel

AffectState = Literal["Engaged", "Neutral", "Frustrated", "Fatigued"]
RiskLevel = Literal["Low", "Moderate", "Elevated"]
AttentionLevel = Literal["High", "Moderate", "Fragmented"]
TaskPerformanceLevel = Literal["Strong", "Mixed", "Weak", "Insufficient"]
Phenotype = Literal[
    "regulated-attention",
    "compensatory-control",
    "behavioral-fragmentation",
    "convergent-risk",
]
Priority = Literal["high", "medium", "low"]

MAX_EEG_EPOCHS = 20_000
MAX_EVENTS = 5_000
MAX_DURATION_MS = 86_400_000


class ShapFeatureInput(ApiModel):
    feature: str = Field(
        min_length=1,
        max_length=120,
        validation_alias=AliasChoices("feature", "featureName", "feature_name", "name"),
    )
    impact: float = Field(
        ge=-1_000_000,
        le=1_000_000,
        validation_alias=AliasChoices(
            "impact",
            "shapValue",
            "shap_value",
            "shap",
            "contribution",
            "value",
        ),
    )
    feature_value: float | None = Field(
        default=None,
        ge=-1_000_000,
        le=1_000_000,
        validation_alias=AliasChoices("featureValue", "feature_value"),
    )


class EegInput(ApiModel):
    adhd_probability: float = Field(
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices("adhdProbability", "probability", "adhd_probability"),
    )
    predicted_class: str | None = Field(
        default=None,
        max_length=64,
        validation_alias=AliasChoices("predictedClass", "prediction", "predicted_class"),
    )
    theta_beta_ratio: dict[str, float] | float = Field(
        default_factory=dict,
        validation_alias=AliasChoices("thetaBetaRatio", "thetaBeta", "tbr", "theta_beta_ratio"),
    )
    frontal_alpha_asymmetry: float | None = Field(
        default=None,
        ge=-1_000_000,
        le=1_000_000,
        validation_alias=AliasChoices(
            "frontalAlphaAsymmetry",
            "frontalAlpha",
            "faa",
            "frontal_alpha_asymmetry",
        ),
    )
    spectral_entropy: float | None = Field(
        default=None,
        ge=0.0,
        le=1_000_000,
        validation_alias=AliasChoices("spectralEntropy", "spectral_entropy"),
    )
    confidence_level: str | None = Field(
        default=None,
        max_length=32,
        validation_alias=AliasChoices("confidenceLevel", "confidence"),
    )
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    artifact_version: str | None = Field(default=None, max_length=120)
    top_shap_features: list[ShapFeatureInput] = Field(
        default_factory=list,
        max_length=24,
        validation_alias=AliasChoices(
            "topShapFeatures",
            "shapFeatures",
            "top_shap_features",
        ),
    )
    epoch_timestamps_ms: list[Annotated[int, Field(ge=0, le=MAX_DURATION_MS)]] = Field(
        default_factory=list,
        max_length=MAX_EEG_EPOCHS,
        validation_alias=AliasChoices(
            "epochTimestampsMs",
            "eegEpochTimestampsMs",
            "epoch_timestamps_ms",
        ),
    )

    @field_validator("theta_beta_ratio")
    @classmethod
    def ratios_are_finite_and_nonnegative(cls, value: dict[str, float] | float) -> dict[str, float] | float:
        values = value.values() if isinstance(value, dict) else [value]
        if any(not math.isfinite(item) or item < 0 for item in values):
            raise ValueError("thetaBetaRatio values must be finite and nonnegative.")
        return value

    @field_validator("epoch_timestamps_ms")
    @classmethod
    def epoch_timestamps_are_sorted(cls, values: list[int]) -> list[int]:
        if any(later < earlier for earlier, later in pairwise(values)):
            raise ValueError("EEG epoch timestamps must be in ascending order.")
        return values


class BlockProgressionInput(ApiModel):
    block_index: int | None = Field(
        default=None,
        ge=0,
        le=999,
        validation_alias=AliasChoices("block", "index", "blockIndex"),
    )
    accuracy_pct: float = Field(
        ge=0.0,
        le=100.0,
        validation_alias=AliasChoices(
            "accuracyPct",
            "accuracyPercent",
            "accuracy_percent",
            "accuracy",
        ),
    )
    mean_rt_ms: float | None = Field(
        default=None,
        ge=0.0,
        le=300_000,
        validation_alias=AliasChoices("meanRtMs", "meanRt", "reactionTimeMs", "mean_rt_ms"),
    )


class ActivityInput(ApiModel):
    task_type: str | None = Field(
        default=None,
        max_length=64,
        validation_alias=AliasChoices("taskType", "task_type"),
    )
    accuracy_pct: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Task accuracy as a percentage from 0 to 100.",
        validation_alias=AliasChoices(
            "accuracyPct",
            "accuracyPercent",
            "accuracy_percent",
            "accuracy",
        ),
    )
    mean_rt_ms: float | None = Field(
        default=None,
        ge=0.0,
        le=300_000,
        validation_alias=AliasChoices(
            "meanRtMs",
            "reactionTimeMs",
            "meanReactionTimeMs",
            "reaction_time_ms",
        ),
    )
    rt_variability_sd_ms: float | None = Field(
        default=None,
        ge=0.0,
        le=300_000,
        validation_alias=AliasChoices(
            "rtVariabilitySdMs",
            "rtVariabilityMs",
            "rtSdMs",
            "reactionTimeSdMs",
            "reaction_time_sd_ms",
        ),
    )
    reaction_time_cv: float | None = Field(
        default=None,
        ge=0.0,
        le=5.0,
        validation_alias=AliasChoices(
            "reactionTimeCv",
            "reactionTimeVariability",
            "rtCv",
            "reaction_time_cv",
        ),
    )
    commission_errors: int = Field(default=0, ge=0, le=10_000)
    omission_errors: int = Field(default=0, ge=0, le=10_000)
    total_trials: int | None = Field(default=None, ge=1, le=10_000)
    block_progression: list[BlockProgressionInput | float] = Field(
        default_factory=list,
        max_length=64,
        validation_alias=AliasChoices(
            "blockProgression",
            "blockScores",
            "block_progression",
        ),
    )
    block_accuracy_percent: list[Annotated[float, Field(ge=0.0, le=100.0)]] = Field(
        default_factory=list,
        max_length=64,
        validation_alias=AliasChoices(
            "blockAccuracyPercent",
            "accuracyByBlock",
            "block_accuracy_percent",
        ),
    )


class OffScreenEpisodeInput(ApiModel):
    start_ms: int = Field(
        ge=0,
        le=MAX_DURATION_MS,
        validation_alias=AliasChoices(
            "startMs",
            "startTimeMs",
            "startTimestampMs",
            "start_ms",
            "start_time_ms",
        ),
    )
    end_ms: int | None = Field(
        default=None,
        ge=0,
        le=MAX_DURATION_MS,
        validation_alias=AliasChoices(
            "endMs",
            "endTimeMs",
            "endTimestampMs",
            "end_ms",
            "end_time_ms",
        ),
    )
    duration_ms: int | None = Field(default=None, ge=0, le=MAX_DURATION_MS)
    root_cause: str | None = Field(
        default=None,
        max_length=64,
        validation_alias=AliasChoices("rootCause", "cause", "root_cause"),
    )
    recovery_latency_ms: float | None = Field(
        default=None,
        ge=0.0,
        le=3_600_000.0,
        validation_alias=AliasChoices(
            "recoveryLatencyMs",
            "recoveryTimeMs",
            "recoveryMs",
            "recovery_latency_ms",
        ),
    )

    @model_validator(mode="after")
    def end_is_after_start(self) -> OffScreenEpisodeInput:
        if self.end_ms is None:
            if self.duration_ms is None:
                raise ValueError("Each off-screen episode needs endMs or durationMs.")
            self.end_ms = self.start_ms + self.duration_ms
        if self.end_ms < self.start_ms:
            raise ValueError("endMs must be greater than or equal to startMs.")
        return self


class EmotionTimelinePointInput(ApiModel):
    state: AffectState = Field(validation_alias=AliasChoices("state", "emotion", "affect"))
    elapsed_ms: int = Field(
        ge=0,
        le=MAX_DURATION_MS,
        validation_alias=AliasChoices(
            "elapsedMs",
            "timestampMs",
            "timestamp_ms",
            "timeMs",
            "performanceNow",
        ),
    )
    performance_now: float | None = Field(default=None, ge=0)
    timestamp: datetime | None = None


class WebcamInput(ApiModel):
    focus_percentage: float = Field(ge=0.0, le=100.0)
    total_blinks: int = Field(default=0, ge=0, le=100_000)
    blink_rate_per_min: float | None = Field(
        default=None,
        ge=0.0,
        le=1_000.0,
        validation_alias=AliasChoices(
            "blinkRatePerMin",
            "blinkRate",
            "meanBlinkRatePerMin",
            "mean_blink_rate_per_min",
            "blink_rate_per_min",
        ),
    )
    distraction_count: int = Field(default=0, ge=0, le=100_000)
    avg_recovery_latency_ms: float = Field(default=0.0, ge=0.0, le=3_600_000.0)
    total_distraction_duration_ms: int = Field(default=0, ge=0, le=MAX_DURATION_MS)
    longest_distraction_ms: int = Field(default=0, ge=0, le=MAX_DURATION_MS)
    face_visible_percentage: float = Field(default=100.0, ge=0.0, le=100.0)
    session_duration_ms: int | None = Field(default=None, ge=1, le=MAX_DURATION_MS)
    emotion_timeline: list[EmotionTimelinePointInput] = Field(
        default_factory=list,
        max_length=MAX_EVENTS,
    )
    off_screen_episodes: list[OffScreenEpisodeInput] = Field(
        default_factory=list,
        max_length=MAX_EVENTS,
    )
    blink_timestamps_ms: list[Annotated[int, Field(ge=0, le=MAX_DURATION_MS)]] = Field(
        default_factory=list,
        max_length=MAX_EVENTS,
    )
    alert_timestamps_ms: list[Annotated[int, Field(ge=0, le=MAX_DURATION_MS)]] = Field(
        default_factory=list,
        max_length=1_000,
    )


class SessionAnalysisRequest(ApiModel):
    session_id: str | None = Field(default=None, max_length=128)
    activity_type: str | None = Field(default=None, max_length=64)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    eeg: EegInput
    activity: ActivityInput
    webcam: WebcamInput
    eeg_epoch_timestamps_ms: list[Annotated[int, Field(ge=0, le=MAX_DURATION_MS)]] = Field(
        default_factory=list,
        max_length=MAX_EEG_EPOCHS,
        validation_alias=AliasChoices(
            "eegEpochTimestampsMs",
            "eegEpochs",
            "eeg_epoch_timestamps_ms",
        ),
    )
    session_duration_ms: int | None = Field(default=None, ge=1, le=MAX_DURATION_MS)

    @field_validator("eeg_epoch_timestamps_ms")
    @classmethod
    def epochs_are_sorted(cls, values: list[int]) -> list[int]:
        if any(later < earlier for earlier, later in pairwise(values)):
            raise ValueError("EEG epoch timestamps must be in ascending order.")
        return values

    @model_validator(mode="after")
    def timestamps_are_ordered(self) -> SessionAnalysisRequest:
        if self.started_at is None or self.completed_at is None:
            return self
        if self.started_at.tzinfo is None or self.completed_at.tzinfo is None:
            raise ValueError("startedAt and completedAt must include a timezone.")
        if self.completed_at < self.started_at:
            raise ValueError("completedAt must be on or after startedAt.")
        return self


class FlaggedEpochWindow(ApiModel):
    start_epoch_index: int
    end_epoch_index: int
    start_timestamp_ms: int
    end_timestamp_ms: int
    sources: list[Literal["blink", "alert"]]


class EegArtifactAnalysis(ApiModel):
    total_epochs: int
    blink_artifact_epochs: int
    alert_artifact_epochs: int
    overlapping_artifact_epochs: int
    flagged_epochs: int
    clean_epochs: int
    artifact_percentage: float
    eeg_signal_cleanliness_pct: float
    quality_rating: Literal["excellent", "good", "fair", "poor"]
    flagged_windows: list[FlaggedEpochWindow]


class PairwiseAlignment(ApiModel):
    modalities: list[Literal["eeg", "webcam", "task"]]
    status: Literal["aligned", "discordant", "insufficient"]
    note: str


class ConcordanceProfile(ApiModel):
    eeg_risk_level: RiskLevel
    webcam_attention_level: AttentionLevel
    task_performance_level: TaskPerformanceLevel
    convergence_level: Literal["aligned-low-risk", "partial", "convergent", "discordant"]
    phenotype: Phenotype
    interpretation: str
    pairwise_alignment: list[PairwiseAlignment]


class TimeSeriesPoint(ApiModel):
    minute: int
    start_offset_ms: int
    end_offset_ms: int
    focus_percentage: float
    blink_rate_per_min: float
    task_accuracy_percentage: float | None
    frustration_index: float
    fatigue_index: float
    dominant_affect: AffectState


class DurationBand(ApiModel):
    band: Literal["brief", "moderate", "prolonged"]
    count: int
    total_duration_ms: int


class RootCauseBreakdown(ApiModel):
    root_cause: str
    count: int
    total_duration_ms: int
    mean_recovery_latency_ms: float


class DistractionBreakdown(ApiModel):
    total_distractions: int
    off_screen_episode_count: int
    total_off_screen_duration_ms: int
    longest_off_screen_duration_ms: int
    mean_recovery_latency_ms: float
    recovery_speed: Literal["fast", "moderate", "slow", "unknown"]
    blink_associated_count: int
    fatigue_associated_count: int
    frustration_associated_count: int
    unclassified_count: int
    severity: Literal["minimal", "brief", "intermittent", "sustained"]
    by_root_cause: list[RootCauseBreakdown]
    by_duration_band: list[DurationBand]
    interpretation: str


class Recommendation(ApiModel):
    category: Literal[
        "attention-environment",
        "task-design",
        "rest-and-regulation",
        "data-quality",
        "clinical-discussion",
        "monitoring",
    ]
    title: str
    detail: str
    priority: Priority


class ExecutiveSummary(ApiModel):
    headline: str
    narrative: str
    overall_risk_level: RiskLevel
    phenotype: Phenotype
    key_findings: list[str]
    limitations: list[str]


class SessionAnalysisResponse(ApiModel):
    session_id: str | None
    activity_type: str
    generated_at: datetime
    analysis_version: str
    executive_summary: ExecutiveSummary
    eeg_artifact_analysis: EegArtifactAnalysis
    concordance_profile: ConcordanceProfile
    time_series_overlay: list[TimeSeriesPoint]
    distraction_breakdown: DistractionBreakdown
    personalized_recommendations: list[Recommendation]
