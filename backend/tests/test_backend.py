import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import (
    create_user,
    get_user,
    recommend_mentors,
    update_profile,
)
from app.models import User
from app.schemas import ProfileUpdate, UserCreate


class BackendHandlerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        session_factory = sessionmaker(bind=self.engine, autoflush=False)
        self.db = session_factory()

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def add_user(
        self,
        name: str,
        email: str,
        role: str,
        profile_text: str,
        career_goals: str = "",
    ):
        return create_user(
            UserCreate(
                name=name,
                email=email,
                role=role,
                profile_text=profile_text,
                career_goals=career_goals,
            ),
            self.db,
        )

    def test_create_and_get_user_profile(self) -> None:
        user = self.add_user(
            "Graduate Example",
            "GRADUATE@example.test",
            "graduate",
            "Interested in Python backend development.",
        )

        retrieved = get_user(user.id, self.db)

        self.assertEqual(retrieved.email, "graduate@example.test")
        self.assertEqual(retrieved.profile_text, "Interested in Python backend development.")

    def test_duplicate_email_returns_conflict(self) -> None:
        self.add_user("First", "same@example.test", "mentor", "Python mentor.")

        with self.assertRaises(HTTPException) as raised:
            self.add_user("Second", "same@example.test", "mentor", "Another profile.")

        self.assertEqual(raised.exception.status_code, 409)

    def test_update_creates_a_missing_profile(self) -> None:
        user = User(
            name="Graduate Without Profile",
            email="no-profile@example.test",
            role="graduate",
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        updated = update_profile(
            user.id,
            ProfileUpdate(profile_text="Python and data analysis."),
            self.db,
        )

        self.assertEqual(updated.profile_text, "Python and data analysis.")

    def test_updating_goals_preserves_profile_text(self) -> None:
        user = self.add_user(
            "Graduate Example",
            "goals@example.test",
            "graduate",
            "Computer science graduate.",
        )

        updated = update_profile(
            user.id,
            ProfileUpdate(career_goals="Become a data engineer."),
            self.db,
        )

        self.assertEqual(updated.profile_text, "Computer science graduate.")
        self.assertEqual(updated.career_goals, "Become a data engineer.")

    def test_recommendations_use_career_goals(self) -> None:
        graduate = self.add_user(
            "Graduate Example",
            "goal-match@example.test",
            "graduate",
            "Recent graduate seeking career guidance.",
            "I want to work in digital marketing and SEO.",
        )
        marketing_mentor = self.add_user(
            "Marketing Mentor",
            "goal-marketing@example.test",
            "mentor",
            "Marketing consultant with SEO and digital campaign experience.",
        )
        self.add_user(
            "Backend Mentor",
            "goal-backend@example.test",
            "mentor",
            "Backend engineer building Python APIs and PostgreSQL systems.",
        )

        results = recommend_mentors(graduate.id, self.db)

        self.assertEqual(results[0]["mentor_id"], marketing_mentor.id)

    def test_recommendations_rank_relevant_mentor_first(self) -> None:
        graduate = self.add_user(
            "Graduate Example",
            "graduate@example.test",
            "graduate",
            "Recent graduate interested in Python APIs and PostgreSQL.",
        )
        self.add_user(
            "Marketing Mentor",
            "marketing@example.test",
            "mentor",
            "Digital marketing specialist focused on SEO and brand strategy.",
        )
        backend_mentor = self.add_user(
            "Backend Mentor",
            "backend@example.test",
            "mentor",
            "Backend engineer building Python APIs with PostgreSQL.",
        )

        results = recommend_mentors(graduate.id, self.db)

        self.assertEqual(results[0]["mentor_id"], backend_mentor.id)
        self.assertEqual(results[0]["name"], "Backend Mentor")
        self.assertGreater(results[0]["score"], results[1]["score"])
        self.assertEqual(
            set(results[0]),
            {"mentor_id", "name", "score", "shared_skills", "profile_text"},
        )

    def test_empty_profiles_return_zero_score_without_crashing(self) -> None:
        graduate = self.add_user(
            "Blank Graduate", "blank-grad@example.test", "graduate", ""
        )
        mentor = self.add_user("Blank Mentor", "blank-mentor@example.test", "mentor", "")

        results = recommend_mentors(graduate.id, self.db)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["mentor_id"], mentor.id)
        self.assertEqual(results[0]["score"], 0.0)
        self.assertEqual(results[0]["shared_skills"], [])

    def test_recommendations_require_a_graduate(self) -> None:
        mentor = self.add_user("Mentor", "mentor@example.test", "mentor", "Python.")

        with self.assertRaises(HTTPException) as raised:
            recommend_mentors(mentor.id, self.db)

        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
