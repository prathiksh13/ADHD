from app.repositories.firestore import path
from tests.test_sessions_and_analytics import _create_subject


def setup_journal(test_app, headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=headers)
    subject = _create_subject(client, headers)
    return client, subject["id"], f"/api/v1/subjects/{subject['id']}/twin-journal"


def test_journal_owner_privacy_consent_and_erasure(test_app, participant_headers):
    client, sid, url = setup_journal(test_app, participant_headers)
    assert client.get(url, headers=participant_headers).json()["entries"] == []
    saved = client.patch(
        url,
        headers=participant_headers,
        json={
            "goal": "Start synthetic homework",
            "entry": {"day": "2026-01-01", "sleepHours": 8, "stress": "low", "goalProgress": "partly"},
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["entries"][0]["goal"] == "Start synthetic homework"
    for token in ("other-participant-token", "caregiver-token", "clinician-token"):
        headers = {"Authorization": f"Bearer {token}"}
        assert client.get(url, headers=headers).status_code == 404
        assert client.patch(url, headers=headers, json={"goal": "other"}).status_code == 404
        assert client.delete(url, headers=headers).status_code == 404
    exported = client.get(f"/api/v1/subjects/{sid}/export", headers=participant_headers).json()
    assert exported["digitalTwin"]["journal"]["goal"] == "Start synthetic homework"
    consent = client.get(f"/api/v1/subjects/{sid}/consents", headers=participant_headers).json()["items"][0]
    client.post(f"/api/v1/subjects/{sid}/consents/{consent['id']}/withdraw", headers=participant_headers)
    assert client.patch(url, headers=participant_headers, json={"goal": "blocked"}).status_code == 403
    assert client.get(url, headers=participant_headers).status_code == 200
    assert client.delete(url, headers=participant_headers).status_code == 204
    assert client.get(url, headers=participant_headers).json()["goal"] is None


def test_journal_validation_retry_dates_and_goal_history(test_app, participant_headers):
    client, sid, url = setup_journal(test_app, participant_headers)
    assert client.patch(url, headers=participant_headers, json={}).status_code == 422
    assert client.patch(url, headers=participant_headers, json={"goal": "x" * 161}).status_code == 422
    assert (
        client.patch(url, headers=participant_headers, json={"entry": {"day": "invalid"}}).status_code == 422
    )
    assert (
        client.patch(
            url, headers=participant_headers, json={"entry": {"day": "2026-01-01", "sleepHours": 25}}
        ).status_code
        == 422
    )
    client.patch(url, headers=participant_headers, json={"goal": "Goal A"})
    payload = {"entry": {"day": "2026-01-01", "sleepHours": 7}}
    first = client.patch(url, headers=participant_headers, json=payload).json()
    assert client.patch(url, headers=participant_headers, json=payload).json() == first
    client.patch(url, headers=participant_headers, json={"goal": "Goal B"})
    journal = client.get(url, headers=participant_headers).json()
    assert journal["entries"][0]["goal"] == "Goal A"
    client.patch(url, headers=participant_headers, json={"entry": {"day": "2026-01-01", "sleepHours": 9}})
    journal = client.get(url, headers=participant_headers).json()
    assert len(journal["entries"]) == 1 and journal["entries"][0]["sleepHours"] == 9
    erased = client.post(
        f"/api/v1/subjects/{sid}/data-erasure",
        headers=participant_headers,
        json={"confirmation": "ERASE MY DATA"},
    )
    assert erased.status_code == 200, erased.text
    repo = test_app[0].state.repository
    assert repo.get(path("subjects", sid, "digitalTwin", "journal")) is None


def test_journal_retention_is_bounded(test_app, participant_headers):
    client, _, url = setup_journal(test_app, participant_headers)
    for day in range(1, 32):
        response = client.patch(
            url, headers=participant_headers, json={"entry": {"day": f"2026-01-{day:02}"}}
        )
        assert response.status_code == 200, response.text
    entries = response.json()["entries"]
    assert len(entries) == 30
    assert entries[0]["day"] == "2026-01-31" and entries[-1]["day"] == "2026-01-02"
