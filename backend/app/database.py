from collections.abc import Generator

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_database_url


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Create the database engine only when database access is first needed."""
    global _engine
    if _engine is None:
        _engine = create_engine(get_database_url(), pool_pre_ping=True)
    return _engine


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides and closes a database session."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(), autoflush=False, autocommit=False
        )

    session = _session_factory()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create the initial tables for local development."""
    # Import models so their tables are registered on Base.metadata.
    from app import models  # noqa: F401

    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    ensure_career_goals_column(engine)
    ensure_password_hash_column(engine)


def ensure_career_goals_column(engine: Engine) -> None:
    """Add the career_goals field to profiles created by the earlier schema."""
    profile_columns = {
        column["name"] for column in inspect(engine).get_columns("profiles")
    }
    if "career_goals" not in profile_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE profiles "
                    "ADD COLUMN career_goals TEXT NOT NULL DEFAULT ''"
                )
            )


def ensure_password_hash_column(engine: Engine) -> None:
    """Add nullable credential storage to databases created before accounts."""
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "password_hash" not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
            )
