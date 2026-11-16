from fastapi import APIRouter

from app.analysis.schemas import SessionAnalysisRequest, SessionAnalysisResponse
from app.analysis.service import analyze_session
from app.auth.dependencies import VerifiedIdentity

router = APIRouter(prefix="/api/sessions", tags=["session-analysis"])


@router.post("/analyze", response_model=SessionAnalysisResponse)
def analyze_session_route(
    payload: SessionAnalysisRequest,
    _identity: VerifiedIdentity,
) -> SessionAnalysisResponse:
    return analyze_session(payload)
