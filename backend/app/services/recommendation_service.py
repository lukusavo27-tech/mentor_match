from functools import lru_cache
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Profile, User
from app.services.matching_engine import MatchingEngine


@lru_cache(maxsize=1)
def _matching_engine() -> MatchingEngine:
    """Load spaCy once and reuse the matcher for recommendation requests."""
    return MatchingEngine()


def get_recommendations(db: Session, graduate_id: UUID) -> list[dict]:
    graduate = db.scalar(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == graduate_id)
    )
    if graduate is None:
        raise HTTPException(status_code=404, detail="Graduate not found")
    if graduate.role != "graduate":
        raise HTTPException(status_code=400, detail="User is not a graduate")
    if graduate.profile is None:
        raise HTTPException(status_code=400, detail="Graduate profile not found")

    mentors = db.scalars(
        select(User)
        .join(Profile)
        .options(selectinload(User.profile))
        .where(User.role == "mentor")
        .order_by(User.name, User.id)
    ).all()

    mentor_inputs = [
        {
            "id": mentor.id,
            "name": mentor.name,
            "text": mentor.profile.profile_text,
        }
        for mentor in mentors
        if mentor.profile is not None
    ]
    if not mentor_inputs:
        return []

    graduate_text = "\n".join(
        part
        for part in (graduate.profile.profile_text, graduate.profile.career_goals)
        if part
    )
    return _matching_engine().rank_mentors(graduate_text, mentor_inputs)
