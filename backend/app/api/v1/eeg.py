from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from app.auth.dependencies import CurrentUser
from app.core.config import Settings
from app.core.errors import ApiError
from app.eeg.artifacts import ArtifactError, EegModel
from app.eeg.inference import analyze_recording
from app.eeg.preprocessing import EegFileError, EegValidationError
from app.eeg.schema import EXPECTED_CHANNELS, FEATURE_NAMES, FEATURE_SCHEMA_VERSION
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.services.authorization import (
    audit_access,
    get_subject_for_user,
    require_active_consent,
    require_participant_owner,
)
from app.services.sessions import _require_consent_tx

logger = logging.getLogger(__name__)
router = APIRouter(tags=["eeg"])
saved_router = APIRouter(prefix="/subjects", tags=["eeg"])

_READ_CHUNK_BYTES = 1024 * 1024


def _model(request: Request) -> EegModel | None:
    return getattr(request.app.state, "eeg_model", None)


@router.get("/health")
def health(request: Request) -> dict[str, Any]:
    settings: Settings = request.app.state.settings
    model = _model(request)
    model_status = (
        model.status()
        if model is not None
        else {
            "available": False,
            "reason": "model_not_loaded",
            "artifact_version": "unavailable",
            "classifier": "xgboost",
            "classifier_file": None,
            "threshold": settings.eeg_threshold,
            "threshold_source": "configured_default",
            "expected_channels": list(EXPECTED_CHANNELS),
            "feature_count": len(FEATURE_NAMES),
            "feature_schema": FEATURE_SCHEMA_VERSION,
            "scaler_loaded": False,
            "positive_class": "ADHD",
            "negative_class": "Control",
            "graph_encoder_status": "not_loaded",
            "metadata": {},
        }
    )
    return {
        "status": "ok" if model_status["available"] else "degraded",
        "model_loaded": model_status["available"],
        "artifact_version": model_status["artifact_version"],
        "expected_channels": model_status["expected_channels"],
        "threshold": model_status["threshold"],
        "threshold_source": model_status["threshold_source"],
        "feature_count": model_status["feature_count"],
        "feature_schema": model_status["feature_schema"],
        "scaler_loaded": model_status["scaler_loaded"],
        "classifier": model_status["classifier"],
        "classifier_file": model_status["classifier_file"],
        "positive_class": model_status["positive_class"],
        "negative_class": model_status["negative_class"],
        "graph_encoder_status": model_status["graph_encoder_status"],
        "reason": model_status["reason"],
        "preprocessing": {
            "target_sample_rate_hz": settings.eeg_target_sfreq,
            "bandpass_hz": [1.0, 45.0],
            "notch_hz": 50.0,
            "window_seconds": settings.eeg_window_seconds,
            "window_overlap": settings.eeg_window_overlap,
            "amplitude_rejection_uv": settings.eeg_reject_amplitude_uv,
        },
    }


async def _read_upload(upload: UploadFile, *, field: str, limit: int) -> bytes:
    if not upload.filename:
        raise ApiError(422, "missing_file_name", f"{field} must include a filename.")
    chunks: list[bytes] = []
    total = 0
    try:
        while True:
            chunk = await upload.read(_READ_CHUNK_BYTES)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise ApiError(
                    413,
                    "eeg_file_too_large",
                    f"{field} exceeds the {limit}-byte upload limit.",
                )
            chunks.append(chunk)
    finally:
        await upload.close()
    if not chunks:
        raise ApiError(400, "empty_file", f"{field} is empty.")
    return b"".join(chunks)


@router.post("/predict")
async def predict(
    request: Request,
    restEC_file: UploadFile = File(..., description="Eyes Closed EEG recording"),
    restEO_file: UploadFile | None = File(None, description="Optional Eyes Open EEG recording"),
) -> dict[str, Any]:
    model = _model(request)
    if model is None or not model.available:
        reason = model.reason if model is not None else "model_not_loaded"
        raise ApiError(
            503,
            "eeg_model_unavailable",
            f"The EEG model is unavailable ({reason}).",
        )

    settings: Settings = request.app.state.settings
    ec_bytes = await _read_upload(
        restEC_file,
        field="restEC_file",
        limit=settings.eeg_max_upload_bytes,
    )
    eo_bytes: bytes | None = None
    if restEO_file is not None:
        eo_bytes = await _read_upload(
            restEO_file,
            field="restEO_file",
            limit=settings.eeg_max_upload_bytes,
        )

    try:
        return await run_in_threadpool(
            analyze_recording,
            ec_bytes,
            restEC_file.filename,
            eo_bytes,
            restEO_file.filename if restEO_file is not None else None,
            model,
            settings,
        )
    except (EegFileError, EegValidationError, ValueError) as exc:
        reason = str(exc) or "The file could not be interpreted as an EEG recording."
        logger.info("eeg_unscored reason=%s", reason)
        return {
            "status": "Unscored",
            "prediction": "Unscored",
            "probability": None,
            "reason": reason,
        }
    except ArtifactError as exc:
        raise ApiError(503, "eeg_model_unavailable", str(exc)) from exc
    except Exception as exc:
        logger.error("eeg_inference_failed error_type=%s", type(exc).__name__)
        raise ApiError(
            500,
            "eeg_inference_failed",
            "The EEG recording could not be analyzed.",
        ) from exc


@saved_router.post("/{subject_id}/eeg-analyses")
async def save_prediction(
    subject_id: UUID,
    request: Request,
    current_user: CurrentUser,
    restEC_file: UploadFile = File(...),
    restEO_file: UploadFile | None = File(None),
    repository: Repository = Depends(get_repository),
) -> dict[str, Any]:
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    require_active_consent(repository, subject_id, "research")
    result = await predict(request, restEC_file, restEO_file)
    analysis_id, now = str(uuid4()), datetime.now(UTC)
    # Keep only server-derived summary metadata. Signal samples and uploaded files stay transient.
    summary = {key: value for key, value in result.items() if key != "signal_preview"}

    def write(tx):
        _require_consent_tx(tx, str(subject_id))
        tx.set(
            path("subjects", subject_id, "eegAnalyses", analysis_id),
            {
                "result": summary,
                "created_at": now,
            },
        )

    repository.run_transaction(write)
    audit_access(
        repository,
        current_user,
        "eeg_analysis_saved",
        "eeg_analysis",
        subject_id=subject_id,
        resource_id=analysis_id,
    )
    return {**result, "analysis_id": analysis_id, "created_at": now.isoformat()}


@saved_router.get("/{subject_id}/eeg-analyses")
def list_predictions(
    subject_id: UUID, current_user: CurrentUser, repository: Repository = Depends(get_repository)
) -> dict:
    subject = get_subject_for_user(repository, current_user, subject_id, write=True)
    require_participant_owner(current_user, subject)
    records = repository.list(
        path("subjects", subject_id, "eegAnalyses"), order_by=("created_at", "desc"), limit=30
    )
    audit_access(repository, current_user, "eeg_analyses_read", "eeg_analysis", subject_id=subject_id)
    return {"items": [{"id": r.id, "createdAt": r.created_at, "result": r.result} for r in records]}
