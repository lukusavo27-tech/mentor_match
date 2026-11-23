import os

from dotenv import load_dotenv


load_dotenv()


def get_database_url() -> str:
    """Return the configured SQLAlchemy database URL."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env and configure it."
        )
    # Render may provide either PostgreSQL URL scheme; this project uses psycopg 3.
    if database_url.startswith("postgres://"):
        database_url = "postgresql+psycopg://" + database_url.removeprefix(
            "postgres://"
        )
    elif database_url.startswith("postgresql://"):
        database_url = "postgresql+psycopg://" + database_url.removeprefix(
            "postgresql://"
        )
    return database_url


def get_auth_secret() -> str:
    """Return the configured signing key for session tokens."""
    secret = os.getenv("MENTORMATCH_SECRET_KEY")
    if (
        not secret
        or secret == "generate-a-random-secret-at-least-32-bytes-long"
        or len(secret.encode("utf-8")) < 32
    ):
        raise RuntimeError(
            "MENTORMATCH_SECRET_KEY must be set to at least 32 bytes."
        )
    return secret
