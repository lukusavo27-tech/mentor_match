from fastapi import APIRouter
from sqlalchemy import text
from app.db import engine

router = APIRouter(tags=["Health"])

@router.get("/health")
def health():
    return {"status": "healthy", "service": "mentormatch-api"}

@router.get("/health/database")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as exc:
        return {"status": "unavailable", "detail": str(exc)}
