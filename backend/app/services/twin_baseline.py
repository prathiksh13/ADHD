"""Personal reference windows, not population norms or clinical confidence estimates."""

from math import isfinite
from statistics import median
from typing import Any

WINDOW_SIZE = 3


def _number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and isfinite(value)


def personal_baseline(records: list[Any]) -> dict[str, Any]:
    latest = records[-1]
    signature = (latest.get("calculation_version"), latest.get("configuration_version"))
    # Restart after a scoring/configuration change, including a change back to an old version.
    comparable = []
    for record in reversed(records):
        if (record.get("calculation_version"), record.get("configuration_version")) != signature:
            break
        comparable.append(record)
    comparable.reverse()
    known_version = bool(signature[0])
    if not known_version:
        comparable = comparable[-1:]
    baseline = comparable[:WINDOW_SIZE]
    ready = len(comparable) >= WINDOW_SIZE * 2 and known_version
    recent = comparable[-WINDOW_SIZE:] if ready else []
    days = len({r["created_at"].date() for r in comparable})
    metrics = []
    for key in latest["metrics"]:
        base_values = [r["metrics"].get(key) for r in baseline]
        recent_values = [r["metrics"].get(key) for r in recent]
        base_ok = len(base_values) == WINDOW_SIZE and all(_number(v) for v in base_values)
        recent_ok = len(recent_values) == WINDOW_SIZE and all(_number(v) for v in recent_values)
        if not _number(latest["metrics"][key]):
            continue
        base = round(median(base_values), 3) if base_ok else None
        current = round(median(recent_values), 3) if recent_ok else None
        metrics.append(
            {
                "key": key,
                "baseline_median": base,
                "recent_median": current,
                "change": round(current - base, 3) if current is not None and base is not None else None,
            }
        )
    return {
        "method": "first-3-vs-latest-3-median-v1",
        "status": "comparison_ready" if ready else "baseline_ready" if len(comparable) >= 3 else "building",
        "comparable_run_count": len(comparable),
        "observation_days": days,
        "runs_needed": max(0, WINDOW_SIZE * 2 - len(comparable)),
        "baseline_source_ids": [str(r["id"]) for r in baseline] if len(baseline) == 3 else [],
        "recent_source_ids": [str(r["id"]) for r in recent],
        "measurements": metrics,
        "trend": [
            {
                "source_id": str(r["id"]),
                "completed_at": r["created_at"].isoformat(),
                "metrics": {k: v for k, v in r["metrics"].items() if _number(v)},
            }
            for r in comparable[-20:]
        ],
        "quality_flags": (["scoring_or_configuration_changed"] if len(comparable) < len(records) else [])
        + (["unknown_scoring_version"] if not known_version else [])
        + (["single_day_observations"] if days == 1 else []),
    }
