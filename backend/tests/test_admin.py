import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.bootstrap_admin import create_admin_account, require_bootstrap_confirmation
from app.database import Base
from app.main import (
    admin_delete_user_endpoint,
    admin_list_users_endpoint,
    admin_summary_endpoint,
    admin_update_user_status_endpoint,
    get_current_user,
    login,
)
from app.models import (
    GoalUpdate,
    MenteeGoal,
    MentorAvailability,
    MentorshipSession,
    Profile,
    ProfileSkill,
    Recommendation,
    User,
)
from app.schemas import AdminUserStatusUpdate, LoginRequest
from app.services.auth import create_access_token, hash_password, verify_password


class AdminFeatureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.secret_patch = patch.dict(
            os.environ,
            {"MENTORMATCH_SECRET_KEY": "admin-test-secret-key-0123456789abcdef"},
        )
        self.secret_patch.start()
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.admin = self.add_user("Admin", "admin@example.test", "graduate", True)
        self.graduate = self.add_user(
            "Graduate User", "graduate@example.test", "graduate"
        )
        self.mentor = self.add_user("Mentor User", "mentor@example.test", "mentor")

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.secret_patch.stop()

    def add_user(
        self, name: str, email: str, role: str, is_admin: bool = False
    ) -> User:
        user = User(
            name=name,
            email=email,
            role=role,
            password_hash=hash_password("LongAdminTestPassword123!"),
            is_admin=is_admin,
            profile=Profile(profile_text=f"{name} profile"),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def test_non_admin_cannot_access_admin_endpoints(self) -> None:
        with self.assertRaises(HTTPException) as summary_error:
            admin_summary_endpoint(self.db, self.graduate)
        with self.assertRaises(HTTPException) as users_error:
            admin_list_users_endpoint(db=self.db, current_user=self.mentor)

        self.assertEqual(summary_error.exception.status_code, 403)
        self.assertEqual(users_error.exception.status_code, 403)

    def test_admin_can_filter_users_and_view_summary_without_profile_text(self) -> None:
        summary = admin_summary_endpoint(self.db, self.admin)
        results = admin_list_users_endpoint(
            search="graduate",
            role="graduate",
            db=self.db,
            current_user=self.admin,
        )

        self.assertEqual(summary.total_users, 3)
        self.assertEqual(summary.active_users, 3)
        self.assertEqual(summary.graduates, 1)
        self.assertEqual([user.email for user in results], ["graduate@example.test"])
        self.assertFalse(hasattr(results[0], "profile_text"))

    def test_admin_can_suspend_and_reactivate_user_and_tokens_stop_working(self) -> None:
        token = create_access_token(self.graduate.id)
        suspended = admin_update_user_status_endpoint(
            self.graduate.id,
            AdminUserStatusUpdate(is_active=False),
            self.db,
            self.admin,
        )

        self.assertFalse(suspended.is_active)
        with self.assertRaises(HTTPException) as login_error:
            login(
                LoginRequest(
                    email=self.graduate.email,
                    password="LongAdminTestPassword123!",
                ),
                self.db,
            )
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=token
        )
        with self.assertRaises(HTTPException) as token_error:
            get_current_user(credentials, self.db)

        self.assertEqual(login_error.exception.status_code, 401)
        self.assertEqual(token_error.exception.status_code, 401)

        reactivated = admin_update_user_status_endpoint(
            self.graduate.id,
            AdminUserStatusUpdate(is_active=True),
            self.db,
            self.admin,
        )
        self.assertTrue(reactivated.is_active)

    def test_admin_cannot_suspend_or_delete_self(self) -> None:
        with self.assertRaises(HTTPException) as suspend_error:
            admin_update_user_status_endpoint(
                self.admin.id,
                AdminUserStatusUpdate(is_active=False),
                self.db,
                self.admin,
            )
        with self.assertRaises(HTTPException) as delete_error:
            admin_delete_user_endpoint(self.admin.id, self.db, self.admin)

        self.assertEqual(suspend_error.exception.status_code, 409)
        self.assertEqual(delete_error.exception.status_code, 409)

    def test_delete_removes_user_owned_sessions_goals_skills_and_matches(self) -> None:
        profile = self.graduate.profile
        mentor_profile = self.mentor.profile
        goal = MenteeGoal(
            mentee_id=self.graduate.id,
            title="Demo goal",
            description="Remove with account",
        )
        goal.updates.append(
            GoalUpdate(note="Progress", progress_percent=20)
        )
        self.db.add_all(
            [
                ProfileSkill(profile_id=profile.id, skill="python"),
                ProfileSkill(profile_id=mentor_profile.id, skill="mentoring"),
                MentorAvailability(
                    mentor_id=self.mentor.id,
                    starts_at=datetime.now(timezone.utc) + timedelta(days=2),
                    ends_at=datetime.now(timezone.utc) + timedelta(days=2, hours=1),
                ),
                Recommendation(
                    graduate_id=self.graduate.id,
                    mentor_id=self.mentor.id,
                    score=0.5,
                    rank=1,
                    shared_skills=["python"],
                ),
                MentorshipSession(
                    mentee_id=self.graduate.id,
                    mentor_id=self.mentor.id,
                    scheduled_at=datetime.now(timezone.utc) + timedelta(days=2),
                    agenda="Demo",
                    status="pending",
                ),
                goal,
            ]
        )
        self.db.commit()
        graduate_id = self.graduate.id
        mentor_id = self.mentor.id

        admin_delete_user_endpoint(graduate_id, self.db, self.admin)

        self.assertIsNone(self.db.get(User, graduate_id))
        self.assertEqual(
            self.db.scalar(
                select(Recommendation.id).where(
                    Recommendation.graduate_id == graduate_id
                )
            ),
            None,
        )
        self.assertEqual(
            self.db.scalar(
                select(MentorshipSession.id).where(
                    MentorshipSession.mentee_id == graduate_id
                )
            ),
            None,
        )
        self.assertEqual(
            self.db.scalar(
                select(MenteeGoal.id).where(MenteeGoal.mentee_id == graduate_id)
            ),
            None,
        )
        self.assertIsNotNone(
            self.db.scalar(
                select(MentorAvailability.id).where(
                    MentorAvailability.mentor_id == mentor_id
                )
            )
        )
        self.assertIsNotNone(self.db.get(User, mentor_id))

        mentor_session = MentorshipSession(
            mentee_id=self.admin.id,
            mentor_id=mentor_id,
            scheduled_at=datetime.now(timezone.utc) + timedelta(days=3),
            agenda="Mentor-owned session",
            status="pending",
        )
        mentor_match = Recommendation(
            graduate_id=self.admin.id,
            mentor_id=mentor_id,
            score=0.4,
            rank=1,
            shared_skills=[],
        )
        self.db.add_all([mentor_session, mentor_match])
        self.db.commit()

        admin_delete_user_endpoint(mentor_id, self.db, self.admin)

        self.assertIsNone(self.db.get(User, mentor_id))
        self.assertIsNone(
            self.db.scalar(
                select(MentorAvailability.id).where(
                    MentorAvailability.mentor_id == mentor_id
                )
            )
        )
        self.assertIsNone(
            self.db.scalar(
                select(MentorshipSession.id).where(
                    MentorshipSession.mentor_id == mentor_id
                )
            )
        )
        self.assertIsNone(
            self.db.scalar(
                select(Recommendation.id).where(
                    Recommendation.mentor_id == mentor_id
                )
            )
        )

    def test_bootstrap_requires_explicit_remote_confirmation(self) -> None:
        remote_url = "postgresql://user:pass@db.example.test/mentor_match"
        with self.assertRaises(RuntimeError):
            require_bootstrap_confirmation(remote_url, allow_remote=False)
        require_bootstrap_confirmation(remote_url, allow_remote=True)
        require_bootstrap_confirmation("sqlite:///local.db", allow_remote=False)

    def test_bootstrap_creates_admin_without_changing_public_role(self) -> None:
        with patch("app.bootstrap_admin.get_engine", return_value=self.engine):
            create_admin_account(
                "New Admin", " NEW.ADMIN@example.test ", "SafeAdminPass123!"
            )

        created = self.db.scalar(
            select(User).where(User.email == "new.admin@example.test")
        )
        self.assertIsNotNone(created)
        self.assertTrue(created.is_admin)
        self.assertTrue(created.is_active)
        self.assertEqual(created.role, "graduate")
        self.assertTrue(verify_password("SafeAdminPass123!", created.password_hash))


if __name__ == "__main__":
    unittest.main()
