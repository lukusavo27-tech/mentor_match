import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import UUID

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import (
    DEMO_ACCOUNT_IDS,
    change_password,
    create_availability_endpoint,
    delete_availability_endpoint,
    get_current_user,
    get_user_endpoint,
    login,
    register_account,
    update_profile_endpoint,
)
from app.models import Profile, User
from app.schemas import (
    AvailabilityCreate,
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdate,
    RegisterRequest,
    UserCreate,
)
from app.seed_demo_data import DEMO_PASSWORD
from app.services.auth import hash_password
from app.main import create_user


class AuthenticationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.secret_patch = patch.dict(
            os.environ, {"MENTORMATCH_SECRET_KEY": "auth-test-secret-key-0123456789abcdef"}
        )
        self.secret_patch.start()
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.session_factory()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.secret_patch.stop()

    @staticmethod
    def registration_body(email: str = "new@example.test") -> RegisterRequest:
        return RegisterRequest(
            name="New Graduate",
            email=email,
            role="graduate",
            password="LongPassphrase123!",
            profile_text="Python and SQL skills",
            career_goals="Become a data engineer",
        )

    def authenticate(self, access_token: str) -> User:
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=access_token
        )
        return get_current_user(credentials, self.db)

    def test_register_login_and_access_owned_profile(self) -> None:
        registration = register_account(self.registration_body(), self.db)
        current = self.authenticate(registration.access_token)
        profile = get_user_endpoint(current.id, self.db, current)
        logged_in = login(
            LoginRequest(email="NEW@example.test", password="LongPassphrase123!"),
            self.db,
        )
        stored_user = self.db.scalar(
            select(User).where(User.email == "new@example.test")
        )

        self.assertEqual(current.id, registration.user.id)
        self.assertEqual(profile.career_goals, "Become a data engineer")
        self.assertEqual(logged_in.user.id, registration.user.id)
        self.assertNotEqual(stored_user.password_hash, "LongPassphrase123!")

    def test_rejects_bad_password_and_missing_bearer_token(self) -> None:
        registration = register_account(self.registration_body(), self.db)

        with self.assertRaises(HTTPException) as bad_login:
            login(LoginRequest(email="new@example.test", password="wrong password"), self.db)
        with self.assertRaises(HTTPException) as missing_token:
            get_current_user(None, self.db)

        self.assertEqual(bad_login.exception.status_code, 401)
        self.assertEqual(missing_token.exception.status_code, 401)
        self.assertEqual(registration.user.email, "new@example.test")

    def test_users_cannot_read_or_change_another_regular_account(self) -> None:
        registration = register_account(self.registration_body(), self.db)
        current = self.authenticate(registration.access_token)
        other = create_user(
            UserCreate(
                name="Other User",
                email="other@example.test",
                role="graduate",
                profile_text="Private profile",
            ),
            self.db,
        )

        with self.assertRaises(HTTPException) as read_error:
            get_user_endpoint(other.id, self.db, current)
        with self.assertRaises(HTTPException) as write_error:
            update_profile_endpoint(
                other.id, ProfileUpdate(career_goals="Changed"), self.db, current
            )

        self.assertEqual(read_error.exception.status_code, 403)
        self.assertEqual(write_error.exception.status_code, 403)

    def test_demo_mentor_can_edit_profile_and_availability(self) -> None:
        demo_id = min(DEMO_ACCOUNT_IDS, key=str)
        demo_user = User(
            id=demo_id,
            name="Demo Mentor",
            email="grace.mentor@example.test",
            role="mentor",
            password_hash=hash_password(DEMO_PASSWORD),
            profile=Profile(profile_text="Demo profile"),
        )
        self.db.add(demo_user)
        self.db.commit()
        logged_in = login(
            LoginRequest(email="grace.mentor@example.test", password=DEMO_PASSWORD),
            self.db,
        )
        current = self.authenticate(logged_in.access_token)
        profile = get_user_endpoint(demo_id, self.db, current)

        updated = update_profile_endpoint(
            demo_id,
            ProfileUpdate(profile_text="Updated mentor expertise"),
            self.db,
            current,
        )
        starts_at = datetime.now(timezone.utc) + timedelta(days=3)
        slot = create_availability_endpoint(
            demo_id,
            AvailabilityCreate(starts_at=starts_at, ends_at=starts_at + timedelta(hours=1)),
            self.db,
            current,
        )
        delete_availability_endpoint(demo_id, slot.id, self.db, current)

        self.assertEqual(profile.name, "Demo Mentor")
        self.assertEqual(updated.profile_text, "Updated mentor expertise")

    def test_demo_graduate_cannot_edit_profile(self) -> None:
        demo_id = next(user_id for user_id in DEMO_ACCOUNT_IDS if str(user_id).startswith("200"))
        graduate = User(
            id=demo_id,
            name="Demo Graduate",
            email="tillen.mentee@example.test",
            role="graduate",
            password_hash=hash_password(DEMO_PASSWORD),
            profile=Profile(profile_text="Demo profile"),
        )
        self.db.add(graduate)
        self.db.commit()
        current = self.authenticate(
            login(
                LoginRequest(email=graduate.email, password=DEMO_PASSWORD), self.db
            ).access_token
        )
        with self.assertRaises(HTTPException) as write_error:
            update_profile_endpoint(
                demo_id, ProfileUpdate(career_goals="Change"), self.db, current
            )
        self.assertEqual(write_error.exception.status_code, 403)

    def test_registration_can_add_password_to_an_existing_local_profile(self) -> None:
        create_user(
            UserCreate(
                name="Existing Graduate",
                email="existing@example.test",
                role="graduate",
                profile_text="Old local profile",
                career_goals="Find a mentor",
            ),
            self.db,
        )

        registered = register_account(
            self.registration_body("existing@example.test"), self.db
        )

        self.assertEqual(registered.user.name, "Existing Graduate")
        self.assertEqual(registered.user.profile_text, "Old local profile")
        self.assertEqual(registered.user.career_goals, "Find a mentor")

    def test_authenticated_user_can_change_password(self) -> None:
        registration = register_account(self.registration_body(), self.db)
        current = self.authenticate(registration.access_token)

        result = change_password(
            PasswordChangeRequest(
                current_password="LongPassphrase123!",
                new_password="AnotherLongPassphrase456!",
            ),
            self.db,
            current,
        )

        self.assertEqual(result["detail"], "Password changed successfully")
        self.assertEqual(
            login(
                LoginRequest(
                    email="new@example.test",
                    password="AnotherLongPassphrase456!",
                ),
                self.db,
            ).user.id,
            registration.user.id,
        )
        with self.assertRaises(HTTPException):
            login(
                LoginRequest(email="new@example.test", password="LongPassphrase123!"),
                self.db,
            )


if __name__ == "__main__":
    unittest.main()
