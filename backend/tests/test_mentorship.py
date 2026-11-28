import unittest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import MentorAvailability, MentorshipSession, Profile, User
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
    list_shared_goals,
    list_availability,
    list_sessions,
    update_goal_status,
    update_session_status,
    opt_out_mentee,
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
                work_url="https://github.com/mentee/api-portfolio",
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
        self.assertEqual(updated.work_url, "https://github.com/mentee/api-portfolio")
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
        goal = create_goal(self.db, self.mentee.id, GoalCreate(title="Learn SQL", work_url="https://github.com/mentee/sql"))
        linked = update_goal_status(
            self.db,
            self.mentee.id,
            goal.id,
            GoalStatusUpdate(work_url="https://github.com/mentee/legacy-work"),
        )
        self.assertEqual(linked.work_url, "https://github.com/mentee/legacy-work")
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

    def test_shared_goals_require_opt_in_and_accepted_mentorship(self) -> None:
        goal = create_goal(
            self.db,
            self.mentee.id,
            GoalCreate(title="Prepare a portfolio", work_url="https://github.com/mentee/portfolio", shared_with_mentor=True),
        )
        self.assertEqual(list_shared_goals(self.db, self.mentor.id), [])

        starts_at = datetime.now(timezone.utc) + timedelta(days=4)
        self.add_opening(starts_at)
        request = create_session(
            self.db,
            self.mentee.id,
            SessionCreate(mentor_id=self.mentor.id, scheduled_at=starts_at),
        )
        self.assertEqual(list_shared_goals(self.db, self.mentor.id), [])
        update_session_status(
            self.db, request.id, self.mentor.id, SessionStatusUpdate(status="accepted")
        )
        shared = list_shared_goals(self.db, self.mentor.id)
        self.assertEqual([item.id for item in shared], [goal.id])
        self.assertEqual(shared[0].mentee_name, self.mentee.name)

        update_goal_status(
            self.db,
            self.mentee.id,
            goal.id,
            GoalStatusUpdate(shared_with_mentor=False),
        )
        self.assertEqual(list_shared_goals(self.db, self.mentor.id), [])

    def test_only_graduates_can_create_goals(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            create_goal(self.db, self.mentor.id, GoalCreate(title="Mentor goal", work_url="https://example.test/work"))
        self.assertEqual(raised.exception.status_code, 400)

    def test_session_request_and_participant_status_transitions(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=4)
        opening = self.add_opening(starts_at)
        self.assertEqual(opening.starts_at.utcoffset(), timedelta(0))
        self.assertEqual(opening.ends_at.utcoffset(), timedelta(0))
        serialized_start = datetime.fromisoformat(
            opening.model_dump(mode="json")["starts_at"]
        )
        self.assertEqual(serialized_start.utcoffset(), timedelta(0))
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
        self.db.expire_all()
        persisted = self.db.get(MentorshipSession, request.id)
        self.assertIsNotNone(persisted)
        self.assertEqual(persisted.status, "accepted")
        self.assertEqual(
            next(
                session
                for session in list_sessions(self.db, self.mentee.id)
                if session.id == request.id
            ).status,
            "accepted",
        )
        completed = update_session_status(
            self.db,
            request.id,
            self.mentor.id,
            SessionStatusUpdate(status="completed"),
        )
        self.assertEqual(accepted.status, "accepted")
        self.assertEqual(completed.status, "completed")

    def test_accepted_session_shares_contacts_and_mentor_can_opt_out(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=6)
        self.add_opening(starts_at)
        shared_goal = create_goal(
            self.db,
            self.mentee.id,
            GoalCreate(
                title="Shared work",
                work_url="https://github.com/mentee/work",
                shared_with_mentor=True,
            ),
        )
        request = create_session(
            self.db,
            self.mentee.id,
            SessionCreate(mentor_id=self.mentor.id, scheduled_at=starts_at),
        )
        pending = list_sessions(self.db, self.mentor.id)[0]
        self.assertIsNone(pending.mentee_email)
        self.assertIsNone(pending.mentee_phone_number)
        self.assertFalse(pending.mentor_opted_out)

        accepted = update_session_status(
            self.db, request.id, self.mentor.id, SessionStatusUpdate(status="accepted")
        )
        self.assertEqual(accepted.mentee_email, self.mentee.email)
        self.assertEqual(accepted.mentor_email, self.mentor.email)
        self.assertEqual([goal.id for goal in list_shared_goals(self.db, self.mentor.id)], [shared_goal.id])

        opt_out_mentee(self.db, self.mentor.id, self.mentee.id)
        opted_out_session = list_sessions(self.db, self.mentor.id)[0]
        self.assertEqual(opted_out_session.status, "cancelled")
        self.assertIsNone(opted_out_session.mentee_email)
        self.assertTrue(opted_out_session.mentor_opted_out)
        self.assertEqual(list_shared_goals(self.db, self.mentor.id), [])
        with self.assertRaises(HTTPException) as opted_out:
            create_session(
                self.db,
                self.mentee.id,
                SessionCreate(mentor_id=self.mentor.id, scheduled_at=starts_at),
            )
        self.assertEqual(opted_out.exception.status_code, 409)

    def test_opt_out_state_is_returned_for_completed_sessions(self) -> None:
        starts_at = datetime.now(timezone.utc) + timedelta(days=7)
        self.add_opening(starts_at)
        request = create_session(
            self.db,
            self.mentee.id,
            SessionCreate(mentor_id=self.mentor.id, scheduled_at=starts_at),
        )
        update_session_status(
            self.db, request.id, self.mentor.id, SessionStatusUpdate(status="accepted")
        )
        update_session_status(
            self.db, request.id, self.mentor.id, SessionStatusUpdate(status="completed")
        )

        opt_out_mentee(self.db, self.mentor.id, self.mentee.id)
        session = list_sessions(self.db, self.mentee.id)[0]

        self.assertEqual(session.status, "completed")
        self.assertTrue(session.mentor_opted_out)
        self.assertIsNone(session.mentor_email)

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

    def test_availability_does_not_list_a_slot_that_has_already_started(self) -> None:
        now = datetime.now(timezone.utc)
        self.db.add(
            MentorAvailability(
                mentor_id=self.mentor.id,
                starts_at=now - timedelta(minutes=10),
                ends_at=now + timedelta(minutes=50),
            )
        )
        self.db.commit()

        self.assertEqual(list_availability(self.db, self.mentor.id), [])

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
            GoalCreate(title="Past deadline", work_url="https://example.test/work", target_date=datetime.now(timezone.utc).date() - timedelta(days=1))


if __name__ == "__main__":
    unittest.main()
