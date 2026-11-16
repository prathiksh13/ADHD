"""Optional owner-only everyday context. Never merged into cognitive or diagnostic scores."""

from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import Field

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import ApiModel
from app.services.authorization import audit_access, get_subject_for_user, require_participant_owner
from app.services.sessions import _require_consent_tx

router = APIRouter(prefix="/subjects", tags=["digital-twin"])


class JournalEntry(ApiModel):
    day: date
    sleep_hours: float | None = Field(default=None, ge=0, le=24, allow_inf_nan=False)
    stress: Literal["low", "medium", "high"] | None = None
    distractions: Literal["few", "some", "many"] | None = None
    goal_progress: Literal["not_attempted", "partly", "achieved"] | None = None


class JournalUpdate(ApiModel):
    goal: str | None = Field(default=None, max_length=160)
    entry: JournalEntry | None = None


def _owner(repository, user, subject_id):
    subject = get_subject_for_user(repository, user, subject_id, write=True)
    require_participant_owner(user, subject)
    return subject


def _view(record):
    return {
        "goal": record.get("goal") if record else None,
        "entries": record.get("entries", []) if record else [],
        "updatedAt": record.get("updated_at") if record else None,
    }


@router.get("/{subject_id}/twin-journal")
def read_journal(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    _owner(repository, current_user, subject_id)
    record = repository.get(path("subjects", subject_id, "digitalTwin", "journal"))
    audit_access(repository, current_user, "twin_journal_read", "twin_journal", subject_id=subject_id)
    return _view(record)


@router.patch("/{subject_id}/twin-journal")
def update_journal(
    subject_id: UUID,
    payload: JournalUpdate,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
) -> dict:
    _owner(repository, current_user, subject_id)
    if not payload.model_fields_set or (payload.entry is None and "goal" not in payload.model_fields_set):
        raise ApiError(422, "empty_journal_update", "Choose a goal or provide a check-in.")
    journal_path = path("subjects", subject_id, "digitalTwin", "journal")
    now, audit_id = datetime.now(UTC), str(uuid4())

    def write(tx):
        _require_consent_tx(tx, str(subject_id))
        stored = tx.get(journal_path) or {}
        goal = payload.goal or None if "goal" in payload.model_fields_set else stored.get("goal")
        entries = list(stored.get("entries", []))
        if payload.entry:
            entry = payload.entry.model_dump(mode="json", by_alias=True)
            entry["goal"] = goal
            entries = [e for e in entries if e["day"] != entry["day"]] + [entry]
            entries = sorted(entries, key=lambda e: e["day"], reverse=True)[:30]
        record = {"goal": goal, "entries": entries, "updated_at": now}
        if stored.get("goal") == goal and stored.get("entries", []) == entries:
            return _view(stored)
        tx.set(journal_path, record)
        tx.set(
            path("auditEvents", audit_id),
            {
                "actor_user_id": str(current_user.id),
                "subject_id": str(subject_id),
                "action": "twin_journal_updated",
                "resource_type": "twin_journal",
                "resource_id": str(subject_id),
                "details": {},
                "created_at": now,
            },
        )
        return _view(record)

    return repository.run_transaction(write)


@router.delete("/{subject_id}/twin-journal", status_code=204)
def delete_journal(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> None:
    _owner(repository, current_user, subject_id)
    repository.delete(path("subjects", subject_id, "digitalTwin", "journal"))
    audit_access(repository, current_user, "twin_journal_deleted", "twin_journal", subject_id=subject_id)
