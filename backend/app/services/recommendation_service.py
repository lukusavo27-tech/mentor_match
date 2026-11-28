from functools import lru_cache
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    MentorAvailability,
    MentorOptOut,
    MentorshipSession,
    Profile,
    ProfileSkill,
    Recommendation,
    User,
)
from app.services.matching_engine import MatchingEngine


@lru_cache(maxsize=1)
def _matching_engine() -> MatchingEngine:
    """Load spaCy once and reuse the matcher for recommendation requests."""
    return MatchingEngine()


def sync_profile_skills(db: Session, profile: Profile, text: str) -> None:
    """Replace a profile's persisted canonical skills after profile changes."""
    skills = _matching_engine().pipeline.extract_skills(text)
    db.query(ProfileSkill).filter(ProfileSkill.profile_id == profile.id).delete()
    db.add_all(
        ProfileSkill(profile_id=profile.id, skill=skill)
        for skill in skills
    )
    db.commit()


def get_recommendations(
    db: Session,
    graduate_id: UUID,
    available_only: bool = False,
) -> list[dict]:
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

    opted_out_ids = set(db.scalars(
        select(MentorOptOut.mentor_id).where(MentorOptOut.mentee_id == graduate_id)
    ).all())
    mentors = db.scalars(
        select(User)
        .join(Profile)
        .options(selectinload(User.profile))
        .where(
            User.role == "mentor",
            User.is_admin.is_(False),
            User.is_active.is_(True),
        )
        .order_by(User.name, User.id)
    ).all()

    mentor_inputs = [
        {
            "id": mentor.id,
            "name": mentor.name,
            "text": mentor.profile.profile_text,
        }
        for mentor in mentors
        if mentor.profile is not None and mentor.id not in opted_out_ids
    ]
    if not mentor_inputs:
        db.execute(
            delete(Recommendation).where(Recommendation.graduate_id == graduate_id)
        )
        db.commit()
        return []

    graduate_parts = dict.fromkeys(
        part.strip()
        for part in (
            graduate.profile.resume_text,
            graduate.profile.profile_text,
            graduate.profile.career_goals,
        )
        if part and part.strip()
    )
    graduate_text = "\n".join(graduate_parts)
    if available_only:
        now = datetime.now(timezone.utc)
        mentor_ids = {mentor["id"] for mentor in mentor_inputs}
        slots = db.scalars(
            select(MentorAvailability).where(
                MentorAvailability.mentor_id.in_(mentor_ids),
                MentorAvailability.starts_at > now,
            )
        ).all()
        active_sessions = db.scalars(
            select(MentorshipSession).where(
                MentorshipSession.mentor_id.in_(mentor_ids),
                MentorshipSession.status.in_(["pending", "accepted"]),
                MentorshipSession.scheduled_at >= now - timedelta(hours=1),
            )
        ).all()
        open_mentor_ids = {
            slot.mentor_id
            for slot in slots
            if not any(
                meeting.mentor_id == slot.mentor_id
                and meeting.scheduled_at < slot.ends_at
                and meeting.scheduled_at + timedelta(hours=1)
                > slot.starts_at
                for meeting in active_sessions
            )
        }
        mentor_inputs = [
            mentor for mentor in mentor_inputs
            if mentor["id"] in open_mentor_ids
        ]

    results = _matching_engine().rank_mentors(graduate_text, mentor_inputs)
    db.execute(
        delete(Recommendation).where(Recommendation.graduate_id == graduate_id)
    )
    db.add_all(
        Recommendation(
            graduate_id=graduate_id,
            mentor_id=result["mentor_id"],
            score=result["score"],
            rank=index,
            shared_skills=result["shared_skills"],
        )
        for index, result in enumerate(results, start=1)
    )
    db.commit()
    return results
