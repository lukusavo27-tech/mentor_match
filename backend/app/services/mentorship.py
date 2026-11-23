from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.models import GoalUpdate, MentorAvailability, MentorshipSession, MenteeGoal, User
from app.schemas import (
    GoalCreate,
    GoalResponse,
    GoalStatusUpdate,
    GoalUpdateCreate,
    GoalUpdateResponse,
    AvailabilityCreate,
    AvailabilityResponse,
    SessionCreate,
    SessionResponse,
    SessionStatusUpdate,
)


def _goal_response(goal: MenteeGoal) -> GoalResponse:
    return GoalResponse(
        id=goal.id,
        mentee_id=goal.mentee_id,
        title=goal.title,
        description=goal.description,
        target_date=goal.target_date,
        status=goal.status,
        progress_percent=goal.progress_percent,
        created_at=goal.created_at,
        updates=[
            GoalUpdateResponse(
                id=update.id,
                goal_id=update.goal_id,
                note=update.note,
                progress_percent=update.progress_percent,
                created_at=update.created_at,
            )
            for update in goal.updates
        ],
    )


def list_goals(db: Session, mentee_id: UUID) -> list[GoalResponse]:
    mentee = db.get(User, mentee_id)
    if mentee is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if mentee.role != "graduate":
        return []
    goals = db.scalars(
        select(MenteeGoal)
        .options(selectinload(MenteeGoal.updates))
        .where(MenteeGoal.mentee_id == mentee_id)
        .order_by(MenteeGoal.created_at.desc())
    ).all()
    return [_goal_response(goal) for goal in goals]


def create_goal(db: Session, mentee_id: UUID, data: GoalCreate) -> GoalResponse:
    mentee = db.get(User, mentee_id)
    if mentee is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if mentee.role != "graduate":
        raise HTTPException(status_code=400, detail="Only graduates can create goals")
    goal = MenteeGoal(
        mentee_id=mentee_id,
        title=data.title,
        description=data.description,
        target_date=data.target_date,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _goal_response(goal)


def add_goal_update(
    db: Session, mentee_id: UUID, goal_id: UUID, data: GoalUpdateCreate
) -> GoalResponse:
    goal = db.scalar(
        select(MenteeGoal)
        .options(selectinload(MenteeGoal.updates))
        .where(MenteeGoal.id == goal_id, MenteeGoal.mentee_id == mentee_id)
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.status == "completed":
        raise HTTPException(status_code=409, detail="Completed goals cannot be updated")
    goal.updates.append(
        GoalUpdate(note=data.note, progress_percent=data.progress_percent)
    )
    goal.progress_percent = data.progress_percent
    if data.progress_percent == 100:
        goal.status = "completed"
    db.commit()
    db.refresh(goal)
    return _goal_response(goal)


def update_goal_status(
    db: Session, mentee_id: UUID, goal_id: UUID, data: GoalStatusUpdate
) -> GoalResponse:
    goal = db.scalar(
        select(MenteeGoal)
        .options(selectinload(MenteeGoal.updates))
        .where(MenteeGoal.id == goal_id, MenteeGoal.mentee_id == mentee_id)
    )
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal.status = data.status
    db.commit()
    db.refresh(goal)
    return _goal_response(goal)


def create_session(
    db: Session, mentee_id: UUID, data: SessionCreate
) -> SessionResponse:
    mentee = db.get(User, mentee_id)
    # Serialize requests per mentor so simultaneous bookings cannot pass the
    # availability/conflict checks at the same time on PostgreSQL.
    mentor = db.scalar(
        select(User).where(User.id == data.mentor_id).with_for_update()
    )
    if mentee is None:
        raise HTTPException(status_code=404, detail="Mentee account not found")
    if mentee.role != "graduate":
        raise HTTPException(status_code=400, detail="Only graduates can request sessions")
    if mentor is None or mentor.role != "mentor":
        raise HTTPException(status_code=404, detail="Mentor account not found")
    if mentor.id == mentee.id:
        raise HTTPException(status_code=400, detail="Choose a different mentor account")

    requested_end = data.scheduled_at + timedelta(hours=1)
    availability = db.scalar(
        select(MentorAvailability).where(
            MentorAvailability.mentor_id == mentor.id,
            MentorAvailability.starts_at <= data.scheduled_at,
            MentorAvailability.ends_at >= requested_end,
        )
    )
    if availability is None:
        raise HTTPException(status_code=409, detail="That time is not available")
    conflict = db.scalar(
        select(MentorshipSession.id).where(
            MentorshipSession.mentor_id == mentor.id,
            MentorshipSession.status.in_(["pending", "accepted"]),
            MentorshipSession.scheduled_at < requested_end,
            MentorshipSession.scheduled_at >= data.scheduled_at - timedelta(hours=1),
        )
    )
    if conflict is not None:
        raise HTTPException(status_code=409, detail="That time has already been requested")

    session = MentorshipSession(
        mentee_id=mentee_id,
        mentor_id=mentor.id,
        scheduled_at=data.scheduled_at,
        agenda=data.agenda,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionResponse(
        id=session.id,
        mentee_id=mentee.id,
        mentor_id=mentor.id,
        mentee_name=mentee.name,
        mentor_name=mentor.name,
        scheduled_at=session.scheduled_at,
        agenda=session.agenda,
        status=session.status,
        created_at=session.created_at,
    )


def list_availability(db: Session, mentor_id: UUID) -> list[AvailabilityResponse]:
    mentor = db.get(User, mentor_id)
    if mentor is None or mentor.role != "mentor":
        raise HTTPException(status_code=404, detail="Mentor account not found")
    now = datetime.now(timezone.utc)
    slots = db.scalars(
        select(MentorAvailability)
        .where(MentorAvailability.mentor_id == mentor_id, MentorAvailability.ends_at > now)
        .order_by(MentorAvailability.starts_at)
    ).all()
    sessions = db.scalars(
        select(MentorshipSession).where(
            MentorshipSession.mentor_id == mentor_id,
            MentorshipSession.status.in_(["pending", "accepted"]),
            MentorshipSession.scheduled_at >= now - timedelta(hours=1),
        )
    ).all()
    available = [
        slot
        for slot in slots
        if not any(
            meeting.scheduled_at < slot.ends_at
            and meeting.scheduled_at + timedelta(hours=1) > slot.starts_at
            for meeting in sessions
        )
    ]
    return [AvailabilityResponse.model_validate(slot, from_attributes=True) for slot in available]


def create_availability(
    db: Session, mentor_id: UUID, data: AvailabilityCreate
) -> AvailabilityResponse:
    mentor = db.scalar(select(User).where(User.id == mentor_id).with_for_update())
    if mentor is None or mentor.role != "mentor":
        raise HTTPException(status_code=400, detail="Only mentors can set availability")
    overlap = db.scalar(
        select(MentorAvailability.id).where(
            MentorAvailability.mentor_id == mentor_id,
            MentorAvailability.starts_at < data.ends_at,
            MentorAvailability.ends_at > data.starts_at,
        )
    )
    if overlap is not None:
        raise HTTPException(status_code=409, detail="Availability overlaps an existing time")
    slot = MentorAvailability(
        mentor_id=mentor_id, starts_at=data.starts_at, ends_at=data.ends_at
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return AvailabilityResponse.model_validate(slot, from_attributes=True)


def delete_availability(db: Session, mentor_id: UUID, slot_id: UUID) -> None:
    slot = db.get(MentorAvailability, slot_id)
    if slot is None or slot.mentor_id != mentor_id:
        raise HTTPException(status_code=404, detail="Availability not found")
    meetings = db.scalars(
        select(MentorshipSession).where(
            MentorshipSession.mentor_id == mentor_id,
            MentorshipSession.status.in_(["pending", "accepted"]),
        )
    ).all()
    if any(
        meeting.scheduled_at < slot.ends_at
        and meeting.scheduled_at + timedelta(hours=1) > slot.starts_at
        for meeting in meetings
    ):
        raise HTTPException(status_code=409, detail="This time has a pending or accepted session")
    db.delete(slot)
    db.commit()


def list_sessions(db: Session, user_id: UUID) -> list[SessionResponse]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")
    mentor = aliased(User)
    mentee = aliased(User)
    rows = db.execute(
        select(MentorshipSession, mentee.name, mentor.name)
        .join(mentee, mentee.id == MentorshipSession.mentee_id)
        .join(mentor, mentor.id == MentorshipSession.mentor_id)
        .where(
            or_(
                MentorshipSession.mentee_id == user_id,
                MentorshipSession.mentor_id == user_id,
            )
        )
        .order_by(MentorshipSession.scheduled_at.desc())
    ).all()
    return [
        SessionResponse(
            id=session.id,
            mentee_id=session.mentee_id,
            mentor_id=session.mentor_id,
            mentee_name=mentee_name,
            mentor_name=mentor_name,
            scheduled_at=session.scheduled_at,
            agenda=session.agenda,
            status=session.status,
            created_at=session.created_at,
        )
        for session, mentee_name, mentor_name in rows
    ]


def update_session_status(
    db: Session,
    session_id: UUID,
    actor_id: UUID,
    data: SessionStatusUpdate,
) -> SessionResponse:
    session = db.get(MentorshipSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if actor_id not in {session.mentee_id, session.mentor_id}:
        raise HTTPException(status_code=403, detail="Only session participants can update it")

    transitions = {
        "pending": {"accepted", "declined", "cancelled"},
        "accepted": {"completed", "cancelled"},
        "declined": set(),
        "cancelled": set(),
        "completed": set(),
    }
    if data.status not in transitions[session.status]:
        raise HTTPException(
            status_code=409,
            detail=f"A {session.status} session cannot be changed to {data.status}",
        )
    if data.status in {"accepted", "declined", "completed"} and actor_id != session.mentor_id:
        raise HTTPException(
            status_code=403,
            detail="Only the mentor can accept, decline, or complete a session",
        )

    session.status = data.status
    db.commit()
    return next(
        item for item in list_sessions(db, actor_id) if item.id == session.id
    )
