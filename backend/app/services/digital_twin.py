from __future__ import annotations

from datetime import UTC, datetime
from math import isfinite
from typing import Any
from uuid import UUID, uuid4

from app.core.errors import ApiError
from app.repositories.firestore import Repository, path
from app.services.catalog import CATALOG
from app.services.cpt_scoring import aggregate_cpt_summaries
from app.services.twin_baseline import personal_baseline
from app.services.twin_insights import twin_v2_insights

TWIN_ALGORITHM_VERSION = "activity-descriptive-twin-v4"


def build_activity_profiles(summaries: list[Any]) -> list[dict[str, Any]]:
    """Keep task measurements separate; never invent a cross-task clinical score."""
    profiles = []
    for activity in CATALOG:
        code = activity["activity_code"]
        records = sorted(
            [item for item in summaries if item.get("activity_code", "cpt") == code],
            key=lambda item: (_value(item, "created_at"), str(_value(item, "id"))),
        )
        if not records:
            continue
        first, latest = records[0], records[-1]
        # Only compare records produced by the same scoring implementation.
        compatible = first.get("calculation_version") == latest.get("calculation_version")
        measurements = []
        for key, value in _value(latest, "metrics").items():
            if isinstance(value, bool) or not isinstance(value, int | float) or not isfinite(value):
                continue
            baseline = _value(first, "metrics").get(key)
            valid_baseline = (
                compatible
                and isinstance(baseline, int | float)
                and not isinstance(baseline, bool)
                and isfinite(baseline)
            )
            measurements.append(
                {
                    "key": key,
                    "latest": round(value, 3),
                    "baseline": round(baseline, 3) if valid_baseline else None,
                    "change": round(value - baseline, 3) if len(records) >= 2 and valid_baseline else None,
                }
            )
        profiles.append(
            {
                "activity_code": code,
                "title": activity["title"],
                "run_count": len(records),
                "status": "available" if len(records) >= 2 and compatible else "insufficient_data",
                "baseline_at": _value(first, "created_at").isoformat(),
                "latest_at": _value(latest, "created_at").isoformat(),
                "source_summary_ids": [str(_value(item, "id")) for item in records],
                "calculation_version": latest.get("calculation_version"),
                "data_provenance": latest.get("data_provenance"),
                "measurements": measurements,
                "personal_baseline": personal_baseline(records),
                "quality_flags": (["fewer_than_two_scored_observations"] if len(records) < 2 else [])
                + (["scoring_version_changed"] if not compatible else []),
            }
        )
    return profiles


def _value(record: Any, key: str) -> Any:
    return record.get(key) if isinstance(record, dict) else getattr(record, key)


def build_twin_snapshot(summaries: list[Any]) -> dict[str, Any]:
    ordered = sorted(summaries, key=lambda item: (_value(item, "created_at"), str(_value(item, "id"))))
    metrics = aggregate_cpt_summaries([_value(item, "metrics") for item in ordered])
    if not ordered or metrics is None:
        return {
            "status": "insufficient_data",
            "summary_count": 0,
            "metrics": None,
            "baseline": None,
            "latest": None,
            "change": None,
            "observation_start": None,
            "observation_end": None,
            "data_provenance": "frontend-cpt-demo-derived-v1",
            "insights": twin_v2_insights([], []),
        }

    baseline, latest = ordered[0], ordered[-1]
    baseline_metrics, latest_metrics = _value(baseline, "metrics"), _value(latest, "metrics")
    accuracy_delta = reaction_time_delta = None
    if len(ordered) >= 2:
        baseline_accuracy, latest_accuracy = (
            baseline_metrics.get("accuracy_percent"),
            latest_metrics.get("accuracy_percent"),
        )
        baseline_rt, latest_rt = (
            baseline_metrics.get("mean_hit_reaction_time_ms"),
            latest_metrics.get("mean_hit_reaction_time_ms"),
        )
        if baseline_accuracy is not None and latest_accuracy is not None:
            accuracy_delta = round(float(latest_accuracy) - float(baseline_accuracy), 2)
        if baseline_rt is not None and latest_rt is not None:
            reaction_time_delta = round(float(latest_rt) - float(baseline_rt), 2)

    enough_data = len(ordered) >= 2
    baseline_created, latest_created = _value(baseline, "created_at"), _value(latest, "created_at")
    return {
        "status": "available" if enough_data else "insufficient_data",
        "summary_count": len(ordered),
        "metrics": metrics,
        "baseline": {"summary_id": str(_value(baseline, "id")), "completed_at": baseline_created.isoformat()},
        "latest": {"summary_id": str(_value(latest, "id")), "completed_at": latest_created.isoformat()},
        "change": {
            "accuracy_delta_percentage_points": accuracy_delta,
            "mean_hit_reaction_time_delta_ms": reaction_time_delta,
        }
        if enough_data
        else None,
        "observation_start": baseline_created.isoformat(),
        "observation_end": latest_created.isoformat(),
        "data_provenance": "frontend-cpt-demo-derived-v1",
        "insights": twin_v2_insights(
            [_value(item, "metrics") for item in ordered],
            [_value(item, "created_at").isoformat() for item in ordered],
        ),
    }


def read_twin_snapshot(
    repository: Repository, subject_id: UUID
) -> tuple[int, dict[str, Any], list[str], datetime | None]:
    profile = repository.get(path("subjects", subject_id, "digitalTwin", "current"))
    if profile is None:
        return 0, build_twin_snapshot([]), ["no_eligible_observations"], None
    return profile["current_version"], profile["profile"], profile["quality_flags"], profile.get("updated_at")


def rebuild_digital_twin(
    repository: Repository, subject_id: UUID, actor_user_id: str | UUID
) -> dict[str, Any]:
    sid = str(subject_id)
    if repository.get(path("subjects", sid)) is None:
        raise ApiError(404, "subject_not_found", "The subject was not found for profile recomputation.")
    now = datetime.now(UTC)
    history_id = str(uuid4())
    audit_id = str(uuid4())

    def write(tx):
        summaries = tx.list(path("subjects", sid, "activitySummaries"))
        summaries.sort(key=lambda item: (item.created_at, item.id))
        cpt_summaries = [item for item in summaries if item.get("activity_code", "cpt") == "cpt"]
        snapshot = build_twin_snapshot(cpt_summaries)
        profiles = build_activity_profiles(summaries)
        snapshot["activity_profiles"] = profiles
        snapshot["total_summary_count"] = sum(item["run_count"] for item in profiles)
        snapshot["status"] = (
            "available" if any(item["status"] == "available" for item in profiles) else "insufficient_data"
        )
        snapshot["algorithm_version"] = TWIN_ALGORITHM_VERSION
        quality_flags = (
            [] if snapshot["status"] == "available" else ["fewer_than_two_comparable_observations"]
        )
        current_path = path("subjects", sid, "digitalTwin", "current")
        current = tx.get(current_path)
        if current and current.get("profile") == snapshot:
            return {**current, "id": sid}
        version = (current.get("current_version", 0) if current else 0) + 1
        record = {
            "current_version": version,
            "profile": snapshot,
            "quality_flags": quality_flags,
            "updated_at": now,
        }
        tx.set(current_path, record)
        tx.set(
            path("subjects", sid, "digitalTwinHistory", history_id),
            {
                "id": history_id,
                "subject_id": sid,
                "version": version,
                "source_summary_ids": [item.id for item in summaries],
                "snapshot": snapshot,
                "quality_flags": quality_flags,
                "algorithm_version": TWIN_ALGORITHM_VERSION,
                "created_at": now,
            },
        )
        tx.set(
            path("auditEvents", audit_id),
            {
                "actor_user_id": str(actor_user_id),
                "subject_id": sid,
                "action": "digital_twin_recomputed",
                "resource_type": "digital_twin_profile",
                "resource_id": sid,
                "details": {"version": version, "source_summary_count": len(summaries)},
                "created_at": now,
            },
        )
        return {**record, "id": sid}

    return repository.run_transaction(write)
