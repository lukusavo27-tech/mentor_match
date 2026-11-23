import unittest

from sqlalchemy import create_engine, inspect, text

from app.database import ensure_career_goals_column, ensure_password_hash_column


class CareerGoalsMigrationTests(unittest.TestCase):
    def test_adds_password_hash_to_an_existing_users_table(self) -> None:
        engine = create_engine("sqlite://")
        with engine.begin() as connection:
            connection.execute(
                text("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)")
            )

        ensure_password_hash_column(engine)

        columns = {column["name"] for column in inspect(engine).get_columns("users")}
        self.assertIn("password_hash", columns)
        engine.dispose()

    def test_adds_goals_to_an_existing_profiles_table(self) -> None:
        engine = create_engine("sqlite://")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE profiles "
                    "(id INTEGER PRIMARY KEY, profile_text TEXT NOT NULL)"
                )
            )
            connection.execute(
                text("INSERT INTO profiles (id, profile_text) VALUES (1, 'resume text')")
            )

        ensure_career_goals_column(engine)

        columns = {column["name"] for column in inspect(engine).get_columns("profiles")}
        self.assertIn("career_goals", columns)
        with engine.connect() as connection:
            goals = connection.execute(
                text("SELECT career_goals FROM profiles WHERE id = 1")
            ).scalar_one()
        self.assertEqual(goals, "")
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
