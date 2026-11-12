from pydantic import BaseModel, Field

class MatchRequest(BaseModel):
    profile_text: str = Field(min_length=10, max_length=20000)
