from fastapi import APIRouter, Request

router = APIRouter(tags=["capabilities"])


@router.get("/capabilities")
def capabilities(request: Request) -> dict:
    settings = request.app.state.settings
    repository = request.app.state.repository
    eeg_model = getattr(request.app.state, "eeg_model", None)
    eeg_available = bool(eeg_model and eeg_model.available)
    return {
        "apiVersion": "v1",
        "databaseConfigured": repository is not None,
        "firestore": {"configured": repository is not None},
        "firebaseAuth": {
            "projectIdConfigured": bool(settings.firebase_project_id),
            "credentials": "application_default_credentials_required_at_runtime",
        },
        "eeg": {
            "available": eeg_available,
            "reason": None if eeg_available else getattr(eeg_model, "reason", "model_not_loaded"),
            "artifactVersion": getattr(eeg_model, "artifact_version", None),
            "expectedChannels": getattr(eeg_model, "channels", ()),
        },
        "webcam": {
            "available": False,
            "reason": "consent_policy_and_supported_feature_extractor_not_configured",
        },
        "aiBuddy": {
            "available": False,
            "reason": "approved_llm_provider_not_configured",
        },
    }
