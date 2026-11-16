from app.repositories.firestore import path
from tests.test_eeg import eeg_app as eeg_app
from tests.test_eeg import fake_bdf
from tests.test_sessions_and_analytics import _create_subject


def test_saved_eeg_is_owner_scoped_and_excludes_signal_samples(eeg_app, participant_headers):
    app, client = eeg_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    sid = subject["id"]
    url = f"/api/v1/subjects/{sid}/eeg-analyses"
    response = client.post(
        url,
        headers=participant_headers,
        files={"restEC_file": ("synthetic.bdf", fake_bdf() + b"\0" * 300_000)},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["signal_preview"]["sample_rate_hz"] == 125
    stored = app.state.repository.get(path("subjects", sid, "eegAnalyses", body["analysis_id"]))
    assert "signal_preview" not in stored.result
    assert "samples" not in str(stored.result)
    listed = client.get(url, headers=participant_headers).json()["items"]
    assert listed[0]["id"] == body["analysis_id"]
    for token in ("other-participant-token", "caregiver-token"):
        other = {"Authorization": f"Bearer {token}"}
        assert client.get(url, headers=other).status_code == 404
        assert (
            client.post(url, headers=other, files={"restEC_file": ("s.bdf", fake_bdf())}).status_code == 404
        )
    exported = client.get(f"/api/v1/subjects/{sid}/export", headers=participant_headers).json()
    assert len(exported["eegAnalyses"]) == 1
    consent = client.get(f"/api/v1/subjects/{sid}/consents", headers=participant_headers).json()["items"][0]
    client.post(f"/api/v1/subjects/{sid}/consents/{consent['id']}/withdraw", headers=participant_headers)
    assert (
        client.post(
            url, headers=participant_headers, files={"restEC_file": ("s.bdf", fake_bdf())}
        ).status_code
        == 403
    )
    erased = client.post(
        f"/api/v1/subjects/{sid}/data-erasure",
        headers=participant_headers,
        json={"confirmation": "ERASE MY DATA"},
    )
    assert erased.status_code == 200
    assert client.get(url, headers=participant_headers).json()["items"] == []
