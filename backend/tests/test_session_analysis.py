from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.repositories.firestore import InMemoryRepository
from tests.conftest import fake_token_verifier

DURATION_MS = 600_000


def _payload(
    *,
    probability: float = 0.78,
    focus: float = 72,
    accuracy: float = 68,
    reaction_time_cv: float = 0.41,
    commission_errors: int = 6,
    omission_errors: int = 5,
    total_trials: int = 40,
    distraction_count: int = 2,
    total_distraction_duration_ms: int = 90_000,
    longest_distraction_ms: int = 60_000,
    blink_timestamps: list[int] | None = None,
    alert_timestamps: list[int] | None = None,
    epoch_timestamps: list[int] | None = None,
    off_screen: list[dict] | None = None,
    emotion_timeline: list[dict] | None = None,
) -> dict:
    return {
        "sessionId": "synthetic-session-001",
        "startedAt": "2026-11-16T10:00:00Z",
        "completedAt": "2026-11-16T10:10:00Z",
        "sessionDurationMs": DURATION_MS,
        "eeg": {
            "adhd_probability": probability,
            "predicted_class": "ADHD" if probability >= 0.5 else "Control",
            "theta_beta_ratio": {"frontal": 3.8, "central": 2.4},
            "frontal_alpha_asymmetry": 0.12,
            "spectral_entropy": 4.2,
            "confidence": "High",
            "threshold": 0.5,
            "artifactVersion": "synthetic-test-model-v1",
            "top_shap_features": [
                {"feature_name": "frontal_theta_rel", "shap_value": 0.18},
                {"feature_name": "theta_beta_ratio", "shap_value": -0.11},
            ],
        },
        "activity": {
            "task_type": "cpt",
            "accuracy_pct": accuracy,
            "mean_rt_ms": 580,
            "rt_variability_sd_ms": reaction_time_cv * 580,
            "commission_errors": commission_errors,
            "omission_errors": omission_errors,
            "total_trials": total_trials,
            "block_progression": [
                {"block": 0, "accuracy_pct": 72},
                {"block": 1, "accuracy_pct": 64},
            ],
        },
        "webcam": {
            "focus_percentage": focus,
            "totalBlinks": 12,
            "blink_rate_per_min": 14,
            "distractionCount": distraction_count,
            "avgRecoveryLatencyMs": 1_800,
            "totalDistractionDurationMs": total_distraction_duration_ms,
            "longestDistractionMs": longest_distraction_ms,
            "faceVisiblePercentage": 95,
            "emotion_timeline": emotion_timeline
            if emotion_timeline is not None
            else [
                {"emotion": "Neutral", "timestamp_ms": 0},
                {"emotion": "Frustrated", "timestamp_ms": 60_000},
                {"emotion": "Neutral", "timestamp_ms": 180_000},
                {"emotion": "Fatigued", "timestamp_ms": 240_000},
                {"emotion": "Neutral", "timestamp_ms": 360_000},
            ],
            "off_screen_episodes": off_screen
            if off_screen is not None
            else [
                {
                    "start_ms": 60_000,
                    "end_ms": 90_000,
                    "root_cause": "frustration",
                    "recovery_latency_ms": 1_800,
                },
                {
                    "start_ms": 240_000,
                    "end_ms": 300_000,
                    "root_cause": "fatigue",
                    "recovery_latency_ms": 2_400,
                },
            ],
            "blink_timestamps_ms": blink_timestamps if blink_timestamps is not None else [10_200, 62_000],
            "alert_timestamps_ms": alert_timestamps if alert_timestamps is not None else [300_000],
        },
        "eeg_epoch_timestamps_ms": epoch_timestamps
        if epoch_timestamps is not None
        else [index * 10_000 for index in range(60)],
    }


def test_analysis_requires_authentication(test_app):
    _, client = test_app
    response = client.post("/api/sessions/analyze", json=_payload())
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"


def test_convergent_analysis_combines_eeg_webcam_and_task(test_app, participant_headers):
    _, client = test_app
    response = client.post("/api/sessions/analyze", headers=participant_headers, json=_payload())

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sessionId"] == "synthetic-session-001"
    assert body["activityType"] == "cpt"
    assert body["analysisVersion"] == "attune-cross-modal-v1"
    assert body["executiveSummary"]["phenotype"] == "convergent-risk"
    assert body["executiveSummary"]["overallRiskLevel"] == "Elevated"
    assert body["executiveSummary"]["headline"].startswith("Multiple attention signals")
    assert any("theta/beta ratio frontal 3.80" in item for item in body["executiveSummary"]["keyFindings"])

    profile = body["concordanceProfile"]
    assert profile["eegRiskLevel"] == "Elevated"
    assert profile["webcamAttentionLevel"] == "Moderate"
    assert profile["taskPerformanceLevel"] == "Mixed"
    assert profile["convergenceLevel"] == "convergent"
    assert profile["phenotype"] == "convergent-risk"

    artifacts = body["eegArtifactAnalysis"]
    assert artifacts["totalEpochs"] == 60
    assert artifacts["flaggedEpochs"] == 2
    assert artifacts["cleanEpochs"] == 58
    assert artifacts["eegSignalCleanlinessPct"] == 96.7
    assert artifacts["qualityRating"] == "excellent"
    assert artifacts["blinkArtifactEpochs"] == 1
    assert artifacts["alertArtifactEpochs"] == 1

    series = body["timeSeriesOverlay"]
    assert len(series) == 10
    assert series[0]["focusPercentage"] == 100
    assert series[1]["focusPercentage"] == 50
    assert series[4]["focusPercentage"] == 0
    assert series[1]["dominantAffect"] == "Frustrated"
    assert series[1]["frustrationIndex"] == 100
    assert series[4]["dominantAffect"] == "Fatigued"
    assert series[4]["fatigueIndex"] == 100
    assert series[0]["blinkRatePerMin"] == 1

    distractions = body["distractionBreakdown"]
    assert distractions["totalDistractions"] == 2
    assert distractions["offScreenEpisodeCount"] == 2
    assert distractions["totalOffScreenDurationMs"] == 90_000
    assert distractions["longestOffScreenDurationMs"] == 60_000
    assert distractions["frustrationAssociatedCount"] == 1
    assert distractions["fatigueAssociatedCount"] == 1
    assert distractions["severity"] == "sustained"
    assert distractions["meanRecoveryLatencyMs"] == 2_100
    assert distractions["recoverySpeed"] == "moderate"
    assert {item["rootCause"]: item["count"] for item in distractions["byRootCause"]} == {
        "fatigue": 1,
        "frustration": 1,
    }

    recommendations = body["personalizedRecommendations"]
    assert recommendations
    assert {item["category"] for item in recommendations} >= {
        "clinical-discussion",
        "rest-and-regulation",
    }
    assert all(item["title"] and item["detail"] for item in recommendations)


def test_regulated_profile_has_low_risk_and_clean_eeg(test_app, participant_headers):
    _, client = test_app
    response = client.post(
        "/api/sessions/analyze",
        headers=participant_headers,
        json=_payload(
            probability=0.2,
            focus=92,
            accuracy=94,
            reaction_time_cv=0.12,
            commission_errors=1,
            omission_errors=0,
            distraction_count=0,
            total_distraction_duration_ms=0,
            longest_distraction_ms=0,
            blink_timestamps=[],
            alert_timestamps=[],
            off_screen=[],
            emotion_timeline=[],
        ),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["executiveSummary"]["phenotype"] == "regulated-attention"
    assert body["executiveSummary"]["overallRiskLevel"] == "Low"
    assert body["concordanceProfile"]["taskPerformanceLevel"] == "Strong"
    assert body["concordanceProfile"]["convergenceLevel"] == "aligned-low-risk"
    assert body["eegArtifactAnalysis"]["eegSignalCleanlinessPct"] == 100
    assert body["distractionBreakdown"]["severity"] == "minimal"
    assert body["timeSeriesOverlay"][0]["focusPercentage"] == 92
    assert body["timeSeriesOverlay"][0]["dominantAffect"] == "Neutral"


def test_compensatory_and_behavioral_profiles_are_distinct(test_app, participant_headers):
    _, client = test_app
    compensatory = client.post(
        "/api/sessions/analyze",
        headers=participant_headers,
        json=_payload(probability=0.72, focus=85, accuracy=88, reaction_time_cv=0.18),
    )
    behavioral = client.post(
        "/api/sessions/analyze",
        headers=participant_headers,
        json=_payload(
            probability=0.2,
            focus=50,
            accuracy=52,
            reaction_time_cv=0.5,
            commission_errors=12,
            omission_errors=8,
            blink_timestamps=[],
            alert_timestamps=[],
        ),
    )

    assert compensatory.status_code == behavioral.status_code == 200
    compensatory_profile = compensatory.json()["concordanceProfile"]
    behavioral_profile = behavioral.json()["concordanceProfile"]
    assert compensatory_profile["phenotype"] == "compensatory-control"
    assert compensatory_profile["convergenceLevel"] == "discordant"
    assert behavioral_profile["phenotype"] == "behavioral-fragmentation"
    assert behavioral_profile["convergenceLevel"] == "partial"


def test_poor_eeg_quality_flags_windows_and_adds_quality_advice(test_app, participant_headers):
    _, client = test_app
    epochs = [index * 1_000 for index in range(10)]
    response = client.post(
        "/api/sessions/analyze",
        headers=participant_headers,
        json=_payload(
            probability=0.75,
            epoch_timestamps=epochs,
            blink_timestamps=epochs,
            alert_timestamps=epochs,
        ),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    artifacts = body["eegArtifactAnalysis"]
    assert artifacts["flaggedEpochs"] == 10
    assert artifacts["cleanEpochs"] == 0
    assert artifacts["eegSignalCleanlinessPct"] == 0
    assert artifacts["qualityRating"] == "poor"
    assert artifacts["flaggedWindows"][0]["sources"] == ["alert", "blink"]
    assert any(
        item["category"] == "data-quality" and item["priority"] == "high"
        for item in body["personalizedRecommendations"]
    )
    assert any("artifacts may have influenced" in item for item in body["executiveSummary"]["limitations"])


def test_minimal_original_payload_without_session_metadata(test_app, participant_headers):
    _, client = test_app
    payload = _payload()
    for key in ("sessionId", "startedAt", "completedAt", "sessionDurationMs"):
        payload.pop(key)
    payload["eeg"]["epoch_timestamps_ms"] = payload.pop("eeg_epoch_timestamps_ms")

    response = client.post("/api/sessions/analyze", headers=participant_headers, json=payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sessionId"] is None
    assert body["activityType"] == "cpt"
    assert body["eegArtifactAnalysis"]["totalEpochs"] == 60
    assert len(body["timeSeriesOverlay"]) == 10


def test_invalid_payloads_are_rejected(test_app, participant_headers):
    _, client = test_app
    unsorted = _payload(epoch_timestamps=[0, 200, 100])
    response = client.post("/api/sessions/analyze", headers=participant_headers, json=unsorted)
    assert response.status_code == 422

    raw_video = _payload()
    raw_video["webcam"]["rawVideo"] = "not-accepted"
    response = client.post("/api/sessions/analyze", headers=participant_headers, json=raw_video)
    assert response.status_code == 422

    backwards = _payload()
    backwards["completedAt"] = "2026-11-16T09:59:00Z"
    response = client.post("/api/sessions/analyze", headers=participant_headers, json=backwards)
    assert response.status_code == 422


def test_analysis_path_allows_more_than_the_generic_body_limit():
    settings = Settings(
        firebase_project_id="test-project",
        cors_origins="http://localhost:3000",
        max_request_bytes=1_000,
        rate_limit_per_minute=0,
        rate_limit_ip_per_minute=0,
    )
    app = create_app(settings, token_verifier=fake_token_verifier, repository=InMemoryRepository())
    payload = _payload()
    payload["sessionId"] = "s" * 128
    payload["eeg"]["artifactVersion"] = "v" * 120
    with TestClient(app) as client:
        response = client.post(
            "/api/sessions/analyze",
            headers={"Authorization": "Bearer participant-token"},
            json=payload,
        )

    assert len(response.request.content) > 1_000
    assert response.status_code == 200, response.text
