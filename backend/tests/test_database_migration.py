import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app import models  # noqa: F401
from app.database import Base, init_db, require_versioned_schema
from app.seed_demo_data import require_local_database


BACKEND_DIR = Path(__file__).resolve().parents[1]


class DatabaseMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "migration-test.sqlite"
        self.database_url = f"sqlite:///{self.database_path}"
        self.database_patch = patch.dict(
            os.environ, {"DATABASE_URL": self.database_url}, clear=False
        )
        self.database_patch.start()
        self.config = Config(str(BACKEND_DIR / "alembic.ini"))

    def tearDown(self) -> None:
        self.database_patch.stop()
        self.temp_dir.cleanup()

    def test_demo_seeder_rejects_remote_database(self) -> None:
        with patch.dict(
            os.environ,
            {"DATABASE_URL": "postgresql://user:pass@db.example.test/mentor_match"},
        ):
            with self.assertRaises(RuntimeError):
                require_local_database()

    def test_demo_seeder_allows_sqlite_and_loopback_postgres(self) -> None:
        for database_url in (
            "sqlite:///local-test.db",
            "postgresql://user:pass@localhost/mentor_match",
        ):
            with self.subTest(database_url=database_url), patch.dict(
                os.environ, {"DATABASE_URL": database_url}
            ):
                require_local_database()

    def test_fresh_database_upgrades_through_all_revisions(self) -> None:
        migration_engine = create_engine(self.database_url)
        with patch("app.database.get_engine", return_value=migration_engine):
            init_db()
        command.check(self.config)

        engine = migration_engine
        try:
            inspector = inspect(engine)
            self.assertTrue(
                {
                    "users",
                    "profiles",
                    "profile_skills",
                    "recommendations",
                    "mentee_goals",
                    "goal_updates",
                    "mentorship_sessions",
                    "mentor_availability",
                    "alembic_version",
                }.issubset(inspector.get_table_names())
            )
            user_columns = {column["name"] for column in inspector.get_columns("users")}
            self.assertIn("is_admin", user_columns)
            self.assertIn("is_active", user_columns)
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO users (id, name, email, role) "
                        "VALUES ('test-user', 'Test User', 'test@example.test', 'graduate')"
                    )
                )
                flags = connection.execute(
                    text("SELECT is_admin, is_active FROM users WHERE email = :email"),
                    {"email": "test@example.test"},
                ).one()
            self.assertEqual(tuple(flags), (False, True))
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "UPDATE users SET is_admin = true "
                        "WHERE email = :email"
                    ),
                    {"email": "test@example.test"},
                )
        finally:
            engine.dispose()
        with self.assertRaisesRegex(RuntimeError, "Cannot remove admin flags"):
            command.downgrade(self.config, "legacy_baseline")

    def test_downgrade_removes_only_empty_admin_flags(self) -> None:
        command.upgrade(self.config, "head")
        command.downgrade(self.config, "legacy_baseline")

        engine = create_engine(self.database_url)
        try:
            columns = {column["name"] for column in inspect(engine).get_columns("users")}
            self.assertNotIn("is_admin", columns)
            self.assertNotIn("is_active", columns)
        finally:
            engine.dispose()

    def test_legacy_baseline_upgrade_preserves_existing_users(self) -> None:
        command.upgrade(self.config, "legacy_baseline")
        engine = create_engine(self.database_url)
        try:
            user_columns = {
                column["name"] for column in inspect(engine).get_columns("users")
            }
            self.assertNotIn("is_admin", user_columns)
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO users (id, name, email, role) "
                        "VALUES ('legacy-user', 'Legacy User', "
                        "'legacy@example.test', 'graduate')"
                    )
                )
        finally:
            engine.dispose()
        command.upgrade(self.config, "head")

        engine = create_engine(self.database_url)
        try:
            with engine.connect() as connection:
                user = connection.execute(
                    text(
                        "SELECT name, is_admin, is_active FROM users "
                        "WHERE email = :email"
                    ),
                    {"email": "legacy@example.test"},
                ).one()
            self.assertEqual(tuple(user), ("Legacy User", False, True))
        finally:
            engine.dispose()

    def test_upgrade_accepts_flags_added_before_alembic_adoption(self) -> None:
        command.upgrade(self.config, "legacy_baseline")
        engine = create_engine(self.database_url)
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN is_admin "
                        "BOOLEAN NOT NULL DEFAULT false"
                    )
                )
                connection.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN is_active "
                        "BOOLEAN NOT NULL DEFAULT true"
                    )
                )
        finally:
            engine.dispose()

        command.stamp(self.config, "legacy_baseline")
        command.upgrade(self.config, "head")
        command.check(self.config)

    def test_existing_unversioned_database_requires_explicit_baseline(self) -> None:
        engine = create_engine(self.database_url)
        try:
            Base.metadata.create_all(engine)
            with self.assertRaisesRegex(RuntimeError, "no Alembic history"):
                require_versioned_schema(engine)
            self.assertIn("users", inspect(engine).get_table_names())
        finally:
            engine.dispose()
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": self.database_url},
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no Alembic history", result.stderr)


if __name__ == "__main__":
    unittest.main()
