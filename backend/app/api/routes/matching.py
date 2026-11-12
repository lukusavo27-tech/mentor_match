from fastapi import APIRouter
from app.schemas.matching import MatchRequest
from app.services.matching import recommend_mentors

router = APIRouter(prefix="/matching", tags=["Matching"])

@router.post("/recommend")
def get_recommendations(payload: MatchRequest):
    # This endpoint currently runs the baseline TF-IDF implementation
    # against the sample mentor corpus in app/services/matching.py.
    return {"recommendations": recommend_mentors(payload.profile_text)}
