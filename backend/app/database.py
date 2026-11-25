from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Connection, Engine, create_engine, inspect
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
    """Apply versioned migrations, refusing to guess at an untracked schema."""
    from alembic import command
    from alembic.config import Config

    from app import models  # noqa: F401

    engine = get_engine()
    require_versioned_schema(engine)
    alembic_config = Config(
        str(Path(__file__).resolve().parents[1] / "alembic.ini")
    )
    command.upgrade(alembic_config, "head")


def require_versioned_schema(engine: Engine | Connection) -> None:
    """Require explicit baseline adoption before migrating existing databases."""
    existing_tables = set(inspect(engine).get_table_names())
    model_tables = set(Base.metadata.tables)
    if "alembic_version" not in existing_tables and existing_tables & model_tables:
        raise RuntimeError(
            "This database has tables but no Alembic history. Verify its schema, "
            "then run `alembic stamp legacy_baseline` and `alembic upgrade head`."
        )
