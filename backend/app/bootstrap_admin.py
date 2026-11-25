"""Interactively create the first administrator account."""
import argparse
from getpass import getpass
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_database_url
from app.database import get_engine, init_db
from app.models import Profile, User
from app.services.auth import hash_password


def require_bootstrap_confirmation(database_url: str, allow_remote: bool) -> None:
    parsed = urlparse(database_url)
    if parsed.scheme.startswith("sqlite"):
        return
    if (parsed.hostname or "").lower() in {"localhost", "127.0.0.1", "::1"}:
        return
    if not allow_remote:
        raise RuntimeError(
            "Admin bootstrap is local-only by default. Pass --allow-remote "
            "explicitly when provisioning a hosted database."
        )


def create_admin_account(name: str, email: str, password: str) -> None:
    if len(name.strip()) < 1 or len(name) > 120:
        raise ValueError("Name must contain 1 to 120 characters")
    if len(password) < 10 or len(password) > 128:
        raise ValueError("Password must contain 10 to 128 characters")

    with Session(get_engine()) as db:
        normalized_email = email.strip().lower()
        if db.scalar(select(User.id).where(User.email == normalized_email)) is not None:
            raise ValueError("An account with that email already exists")
        db.add(
            User(
                name=name.strip(),
                email=normalized_email,
                role="graduate",
                password_hash=hash_password(password),
                is_admin=True,
                profile=Profile(),
            )
        )
        db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="confirm that the configured database is the intended hosted database",
    )
    args = parser.parse_args()
    database_url = get_database_url()
    require_bootstrap_confirmation(database_url, args.allow_remote)

    name = input("Administrator name: ").strip()
    email = input("Administrator email: ").strip()
    password = getpass("Administrator password (10+ characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        raise ValueError("Passwords do not match")
    if "@" not in email or len(email) > 255:
        raise ValueError("Enter a valid email address")
    init_db()
    create_admin_account(name, email, password)
    print(f"Administrator account created for {email.lower()}.")


if __name__ == "__main__":
    main()
