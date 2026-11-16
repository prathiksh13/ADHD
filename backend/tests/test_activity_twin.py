from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.repositories.firestore import InMemoryRepository, path
from app.services.digital_twin import build_activity_profiles, rebuild_digital_twin
from app.services.twin_baseline import personal_baseline


def test_personal_baseline_uses_disjoint_robust_windows():
    records = [summary("stroop", i, accuracy_percent=v) for i, v in enumerate([50, 60, 100, 70, 80, 90])]
    baseline = personal_baseline(records)
    assert baseline["status"] == "comparison_ready"
    assert baseline["measurements"] == [
        {"key": "accuracy_percent", "baseline_median": 60, "recent_median": 80, "change": 20}
    ]
    assert not set(baseline["baseline_source_ids"]) & set(baseline["recent_source_ids"])
    assert personal_baseline(records[:5])["measurements"][0]["change"] is None
    assert personal_baseline(records[:3])["status"] == "baseline_ready"


def test_baseline_resets_on_configuration_change_and_skips_missing_metrics():
    records = [summary("stroop", i, accuracy_percent=80) for i in range(6)]
    records[-1]["configuration_version"] = "new-task"
    baseline = personal_baseline(records)
    assert baseline["comparable_run_count"] == 1
    assert baseline["status"] == "building"
    assert "scoring_or_configuration_changed" in baseline["quality_flags"]
    records[-1].pop("configuration_version")
    records[1]["metrics"]["accuracy_percent"] = None
    assert personal_baseline(records)["measurements"][0]["baseline_median"] is None
    for record in records:
        record["created_at"] = records[0]["created_at"]
    assert "single_day_observations" in personal_baseline(records)["quality_flags"]


def summary(code, index, **metrics):
    return {
        "id": str(index),
        "activity_code": code,
        "metrics": metrics,
        "calculation_version": "test-v1",
        "data_provenance": "synthetic-test",
        "created_at": datetime(2026, 1, 1, tzinfo=UTC) + timedelta(days=index),
    }


def test_tasks_stay_separate_and_are_ordered():
    profiles = build_activity_profiles(
        [
            summary("stroop", 2, accuracy_percent=90, mean_reaction_time_ms=450),
            summary("n-back", 1, accuracy_percent=30),
            summary("stroop", 0, accuracy_percent=70, mean_reaction_time_ms=500),
        ]
    )
    stroop = next(p for p in profiles if p["activity_code"] == "stroop")
    assert stroop["run_count"] == 2
    assert stroop["source_summary_ids"] == ["0", "2"]
    assert stroop["measurements"][0]["change"] == 20
    nback = next(p for p in profiles if p["activity_code"] == "n-back")
    assert nback["status"] == "insufficient_data"
    assert nback["measurements"][0]["change"] is None


def test_changed_scoring_and_invalid_numbers_are_not_compared():
    first = summary("stroop", 0, accuracy_percent=70)
    latest = summary("stroop", 1, accuracy_percent=90, invalid=float("nan"), flag=True)
    latest["calculation_version"] = "test-v2"
    profile = build_activity_profiles([first, latest])[0]
    assert profile["quality_flags"] == ["scoring_version_changed"]
    assert profile["measurements"] == [
        {"key": "accuracy_percent", "latest": 90, "baseline": None, "change": None}
    ]


def test_non_cpt_twin_versions_are_subject_scoped_and_retry_stable():
    repo = InMemoryRepository()
    sid, other = uuid4(), uuid4()
    repo.set(path("subjects", sid), {"owner_user_id": "synthetic-owner"})
    for index in range(2):
        record = summary("stroop", index, accuracy_percent=70 + index * 10)
        repo.set(path("subjects", sid, "activitySummaries", str(index)), record)
    repo.set(
        path("subjects", other, "activitySummaries", "other"), summary("n-back", 3, accuracy_percent=100)
    )
    result = rebuild_digital_twin(repo, sid, "synthetic-owner")
    assert result["profile"]["status"] == "available"
    assert result["profile"]["summary_count"] == 0  # Legacy CPT fields retain their meaning.
    assert result["profile"]["total_summary_count"] == 2
    assert len(result["profile"]["activity_profiles"]) == 1
    assert rebuild_digital_twin(repo, sid, "synthetic-owner")["current_version"] == 1
    assert len(repo.list(path("subjects", sid, "digitalTwinHistory"))) == 1
    repo.set(path("subjects", sid, "activitySummaries", "2"), summary("stroop", 2, accuracy_percent=95))
    assert rebuild_digital_twin(repo, sid, "synthetic-owner")["current_version"] == 2
    assert repo.list(path("subjects", sid, "digitalTwinHistory"))[0]["snapshot"]["total_summary_count"] == 2
