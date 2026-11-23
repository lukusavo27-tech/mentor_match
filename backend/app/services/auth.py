from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.config import get_auth_secret

TOKEN_ISSUER = "mentor-match"
TOKEN_LIFETIME = timedelta(hours=12)
_password_hash = PasswordHash.recommended()
_dummy_password_hash = _password_hash.hash("invalid-login-timing-protection")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, encoded_hash: str | None) -> bool:
    return _password_hash.verify(password, encoded_hash or _dummy_password_hash)


def create_access_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id),
        "iss": TOKEN_ISSUER,
        "iat": now,
        "exp": now + TOKEN_LIFETIME,
    }
    return jwt.encode(claims, get_auth_secret(), algorithm="HS256")


def read_access_token(token: str) -> UUID:
    claims = jwt.decode(
        token,
        get_auth_secret(),
        algorithms=["HS256"],
        issuer=TOKEN_ISSUER,
        options={"require": ["sub", "iss", "iat", "exp"]},
    )
    return UUID(claims["sub"])
