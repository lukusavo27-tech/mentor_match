from pydantic import BaseModel
from typing import Literal

class ProfileRead(BaseModel):
    id: int
    full_name: str
    role: Literal["graduate", "mentor"]
    education: str | None = None
    career_interests: list[str] = []
    skills: list[str] = []
