"""Synthetic derived observations; no camera or live account is used."""
import pytest
from pydantic import ValidationError

from app.attention_schemas import AttentionTelemetry
from app.repositories.firestore import path
from tests.test_go_no_go import _session, _events, GO_NO_GO_SCORED_STIMULI
from tests.test_sessions_and_analytics import _create_subject


def telemetry():
    return dict(schemaVersion=1, provenance="on-device-heuristic-v1", calibrationComplete=True,
                eventsTruncated=False, observedDurationMs=10000, focusPercentage=90,
                totalBlinks=1, meanBlinkRatePerMin=6, distractionCount=1, avgRecoveryLatencyMs=500,
                emotionTimeline=[], telemetryEvents=[dict(type="BLINK", performanceNow=1000,
                elapsedMs=1000, timestamp="2026-01-01T00:00:01.000Z", durationMs=150)],
                sessionDurationMs=12500, faceVisiblePercentage=100, totalDistractionDurationMs=1000,
                longestDistractionMs=1000)


def test_strict_telemetry_rejects_raw_content_and_nonfinite_values():
    assert AttentionTelemetry.model_validate(telemetry()).totalBlinks == 1
    for changes in [dict(rawFrame="data:image/png,x"), dict(focusPercentage=float("nan")),
                    dict(focusPercentage=101), dict(totalBlinks=-1), dict(telemetryEvents=[dict(type="BLINK", rawFrame="x")])]:
        with pytest.raises(ValidationError):
            AttentionTelemetry.model_validate({**telemetry(), **changes})


def test_completion_stores_derived_telemetry_with_existing_ownership_and_consent(test_app, participant_headers):
    app, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment = _session(client, participant_headers, subject["id"], "scored", "attention-01")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment}"
    result = client.post(url + "/events:batch", headers=participant_headers,
                         json={"events": _events(GO_NO_GO_SCORED_STIMULI, "scored")})
    assert result.status_code == 200
    assert client.post(url + "/complete", headers={"Authorization": "Bearer other-participant-token"},
                       json={"attentionTelemetry": telemetry()}).status_code in {403, 404}
    assert client.post(url + "/complete", headers=participant_headers,
                       json={"attentionTelemetry": {**telemetry(), "rawFrame": "x"}}).status_code == 422
    result = client.post(url + "/complete", headers=participant_headers, json={"attentionTelemetry": telemetry()})
    assert result.status_code == 200, result.text
    stored = app.state.repository.get(path("subjects", subject["id"], "sessions", session["id"], "activities", assignment))
    assert stored["attention_telemetry"] == telemetry()
    # Derived telemetry is owner-exportable; ordinary session responses do not expose it to caregivers.
    assert "attentionTelemetry" not in result.json()["activities"][0]
