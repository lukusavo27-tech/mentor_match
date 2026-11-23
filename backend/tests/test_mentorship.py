import unittest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Profile, User
from app.schemas import (
    AvailabilityCreate,
    GoalCreate,
    GoalStatusUpdate,
    GoalUpdateCreate,
    SessionCreate,
    SessionStatusUpdate,
)
from app.services.mentorship import (
    add_goal_update,
    create_availability,
    create_goal,
    create_session,
    list_goals,
    list_availability,
    list_sessions,
    update_goal_status,
    update_session_status,
)


class MentorshipFeatureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.mentee = User(
            name="Mentee",
            email="mentee@example.test",
            role="graduate",
            profile=Profile(profile_text="Python graduate"),
        )
        self.mentor = User(
            name="Mentor",
            email="mentor@example.test",
            role="mentor",
            profile=Profile(profile_text="Python mentor with API experience"),
        )
        self.other = User(
            name="Other",
            email="other@example.test",
            role="graduate",
            profile=Profile(),
        )
        self.db.add_all([self.mentee, self.mentor, self.other])
        self.db.commit()
        self.db.refresh(self.mentee)
        self.db.refresh(self.mentor)
        self.db.refresh(self.other)

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def add_opening(self, starts_at: datetime):
        return create_availability(
            self.db,
            self.mentor.id,
            AvailabilityCreate(
                starts_at=starts_at,
                ends_at=starts_at + timedelta(hours=1),
            ),
        )

    def test_goal_creation_progress_history_and_completion(self) -> None:
        goal = create_goal(
            self.db,
            self.mentee.id,
            GoalCreate(
                title="Build an API portfolio",
                description="Publish two backend projects",
                target_date=(datetime.now(timezone.utc) + timedelta(days=30)).date(),
            ),
        )
        updated = add_goal_update(
            self.db,
            self.mentee.id,
            goal.id,
            GoalUpdateCreate(note="First project is in progress", progress_percent=45),
        )

        self.assertEqual(updated.progress_percent, 45)
        self.assertEqual(len(updated.updates), 1)
        self.assertEqual(updated.updates[0].note, "First project is in progress")

        completed = add_goal_update(
            self.db,
            self.mentee.id,
            goal.id,
            GoalUpdateCreate(note="Both projects are published", progress_percent=100),
        )
        self.assertEqual(completed.status, "completed")
        self.assertEqual(len(list_goals(self.db, self.mentee.id)), 1)

        with self.assertRaises(HTTPException) as raised:
            add_goal_update(
                self.db,
                self.mentee.id,
                goal.id,
                GoalUpdateCreate(note="A completed goal", progress_percent=100),
            )
        self.assertEqual(raised.exception.status_code, 409)

    def test_goal_status_can_be_paused_and_resumed(self) -> None:
        goal = create_goal(self.db, self.mentee.id, GoalCreate(title="Learn SQL"))
        paused = update_goal_status(
            self.db,
            self.mentee.id,
            goal.id,
            GoalStatusUpdate(status="paused"),
        )
        resumed = update_goal_status(
            self.db,
            self.mentee.id,
            goal.id,
            GoalStatusUpdate(status="active"),
        )
        self.assertEqual(paused.status, "paused")
        self.assertEqual(resumed.status, "active")

    def test_only_graduates_can_create_goals(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            create_goal(self.db, self.mentor.id, GoalCreate(title="Mentor goal"))
        self.assertEqual(raised.exception.status_code, 400)

    def test_session_request_and_participant_status_transitions(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=4)
        self.add_opening(starts_at)
        request = create_session(
            self.db,
            self.mentee.id,
            SessionCreate(
                mentor_id=self.mentor.id,
                scheduled_at=starts_at,
                agenda="Review my API project",
            ),
        )
        self.assertEqual(request.status, "pending")
        self.assertEqual(len(list_sessions(self.db, self.mentee.id)), 1)
        self.assertEqual(len(list_sessions(self.db, self.mentor.id)), 1)

        with self.assertRaises(HTTPException) as mentee_accept_error:
            update_session_status(
                self.db,
                request.id,
                self.mentee.id,
                SessionStatusUpdate(status="accepted"),
            )
        self.assertEqual(mentee_accept_error.exception.status_code, 403)

        accepted = update_session_status(
            self.db,
            request.id,
            self.mentor.id,
            SessionStatusUpdate(status="accepted"),
        )
        completed = update_session_status(
            self.db,
            request.id,
            self.mentor.id,
            SessionStatusUpdate(status="completed"),
        )
        self.assertEqual(accepted.status, "accepted")
        self.assertEqual(completed.status, "completed")

    def test_session_requires_an_opening_and_prevents_double_booking(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=3)
        request_data = SessionCreate(mentor_id=self.mentor.id, scheduled_at=starts_at)
        with self.assertRaises(HTTPException) as unavailable:
            create_session(self.db, self.mentee.id, request_data)
        self.assertEqual(unavailable.exception.status_code, 409)

        self.add_opening(starts_at)
        create_session(self.db, self.mentee.id, request_data)
        with self.assertRaises(HTTPException) as booked:
            create_session(self.db, self.other.id, request_data)
        self.assertEqual(booked.exception.status_code, 409)
        self.assertEqual(list_availability(self.db, self.mentor.id), [])

    def test_availability_rejects_overlaps_and_non_one_hour_windows(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=5)
        self.add_opening(starts_at)
        with self.assertRaises(HTTPException) as overlap:
            create_availability(
                self.db,
                self.mentor.id,
                AvailabilityCreate(
                    starts_at=starts_at + timedelta(minutes=30),
                    ends_at=starts_at + timedelta(minutes=90),
                ),
            )
        self.assertEqual(overlap.exception.status_code, 409)
        with self.assertRaises(ValueError):
            AvailabilityCreate(
                starts_at=starts_at,
                ends_at=starts_at + timedelta(minutes=30),
            )

    def test_nonparticipant_cannot_change_a_session(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=2)
        self.add_opening(starts_at)
        request = create_session(
            self.db,
            self.mentee.id,
            SessionCreate(
                mentor_id=self.mentor.id,
                scheduled_at=starts_at,
            ),
        )
        with self.assertRaises(HTTPException) as raised:
            update_session_status(
                self.db,
                request.id,
                self.other.id,
                SessionStatusUpdate(status="cancelled"),
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_session_requires_a_mentor_and_future_timezone_aware_time(self) -> None:
        with self.assertRaises(HTTPException) as wrong_role:
            create_session(
                self.db,
                self.mentee.id,
                SessionCreate(
                    mentor_id=self.other.id,
                    scheduled_at=datetime.now(timezone.utc) + timedelta(days=1),
                ),
            )
        self.assertEqual(wrong_role.exception.status_code, 404)
        with self.assertRaises(ValueError):
            SessionCreate(
                mentor_id=self.mentor.id,
                scheduled_at=datetime.now() + timedelta(days=1),
            )

    def test_goal_target_date_cannot_be_in_the_past(self) -> None:
        with self.assertRaises(ValueError):
            GoalCreate(title="Past deadline", target_date=datetime.now(timezone.utc).date() - timedelta(days=1))


if __name__ == "__main__":
    unittest.main()
