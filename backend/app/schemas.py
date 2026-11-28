from datetime import date, datetime, timedelta, timezone
import re
from typing import Literal
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _as_utc(value: datetime) -> datetime:
    if value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    phone_number: str = Field(default="", max_length=32)
    role: Literal["graduate", "mentor"]
    profile_text: str = Field(default="", max_length=20_000)
    career_goals: str = Field(default="", max_length=5_000)


class RegisterRequest(UserCreate):
    password: str = Field(min_length=10, max_length=128)
    phone_number: str = Field(min_length=7, max_length=32)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if not re.fullmatch(r"\+[1-9][0-9 ()-]{6,29}", value) or not 8 <= len(digits) <= 15:
            raise ValueError("Enter a valid international phone number beginning with + and country code")
        return value


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class ProfileUpdate(BaseModel):
    profile_text: str | None = Field(default=None, max_length=20_000)
    career_goals: str | None = Field(default=None, max_length=5_000)
    phone_number: str | None = Field(default=None, min_length=7, max_length=32)

    @model_validator(mode="after")
    def require_a_field(self):
        if self.profile_text is None and self.career_goals is None and self.phone_number is None:
            raise ValueError("Provide profile_text, career_goals, phone_number, or a combination")
        return self

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str | None) -> str | None:
        if value is not None:
            digits = re.sub(r"\D", "", value)
            if not re.fullmatch(r"\+[1-9][0-9 ()-]{6,29}", value) or not 8 <= len(digits) <= 15:
                raise ValueError("Enter a valid international phone number beginning with + and country code")
        return value


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone_number: str = ""
    role: Literal["graduate", "mentor"]
    profile_text: str
    career_goals: str
    resume_text: str = ""
    is_admin: bool = False


class AdminSummary(BaseModel):
    total_users: int
    active_users: int
    suspended_users: int
    graduates: int
    mentors: int
    pending_sessions: int


class AdminUserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: Literal["graduate", "mentor"]
    is_admin: bool
    is_active: bool
    created_at: datetime


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RecommendationResponse(BaseModel):
    mentor_id: UUID
    name: str
    score: float
    shared_skills: list[str]
    profile_text: str


class GoalCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=180)
    work_url: str = Field(min_length=8, max_length=2048)
    description: str = Field(default="", max_length=5_000)
    target_date: date | None = None
    shared_with_mentor: bool = False

    @field_validator("work_url")
    @classmethod
    def require_http_work_link(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("work_url must be a valid http or https URL")
        return value

    @field_validator("target_date")
    @classmethod
    def target_date_cannot_be_in_past(cls, value: date | None) -> date | None:
        if value is not None and value < date.today():
            raise ValueError("target_date cannot be in the past")
        return value


class GoalUpdateCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    note: str = Field(min_length=1, max_length=2_000)
    progress_percent: int = Field(ge=0, le=100)


class GoalStatusUpdate(BaseModel):
    status: Literal["active", "paused", "completed"] | None = None
    shared_with_mentor: bool | None = None
    work_url: str | None = Field(default=None, min_length=8, max_length=2048)

    @model_validator(mode="after")
    def require_an_update(self):
        if self.status is None and self.shared_with_mentor is None and self.work_url is None:
            raise ValueError("Provide status, shared_with_mentor, work_url, or a combination")
        return self

    @field_validator("work_url")
    @classmethod
    def validate_work_link(cls, value: str | None) -> str | None:
        if value is not None:
            parsed = urlparse(value)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError("work_url must be a valid http or https URL")
        return value


class GoalUpdateResponse(BaseModel):
    id: UUID
    goal_id: UUID
    note: str
    progress_percent: int
    created_at: datetime


class GoalResponse(BaseModel):
    id: UUID
    mentee_id: UUID
    title: str
    work_url: str = ""
    description: str
    target_date: date | None
    status: Literal["active", "paused", "completed"]
    progress_percent: int
    shared_with_mentor: bool = False
    mentee_name: str | None = None
    created_at: datetime
    updates: list[GoalUpdateResponse]


class SessionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    mentor_id: UUID
    scheduled_at: datetime
    agenda: str = Field(default="", max_length=2_000)

    @field_validator("scheduled_at")
    @classmethod
    def require_future_timezone_aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("scheduled_at must include a timezone")
        if value <= datetime.now(timezone.utc):
            raise ValueError("scheduled_at must be in the future")
        return value


class SessionStatusUpdate(BaseModel):
    status: Literal["accepted", "declined", "cancelled", "completed"]


class SessionResponse(BaseModel):
    id: UUID
    mentee_id: UUID
    mentor_id: UUID
    mentee_name: str
    mentor_name: str
    mentee_email: str | None = None
    mentee_phone_number: str | None = None
    mentor_email: str | None = None
    mentor_phone_number: str | None = None
    mentor_opted_out: bool = False
    scheduled_at: datetime
    agenda: str
    status: Literal["pending", "accepted", "declined", "cancelled", "completed"]
    created_at: datetime

    @field_validator("scheduled_at", "created_at")
    @classmethod
    def normalize_timestamps_to_utc(cls, value: datetime) -> datetime:
        return _as_utc(value)


class AvailabilityCreate(BaseModel):
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_window(self):
        if self.starts_at.tzinfo is None or self.starts_at.utcoffset() is None:
            raise ValueError("starts_at must include a timezone")
        if self.ends_at.tzinfo is None or self.ends_at.utcoffset() is None:
            raise ValueError("ends_at must include a timezone")
        if self.starts_at <= datetime.now(timezone.utc):
            raise ValueError("Availability must start in the future")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        if self.ends_at - self.starts_at != timedelta(hours=1):
            raise ValueError("Each availability opening must be one hour")
        return self


class AvailabilityResponse(BaseModel):
    id: UUID
    mentor_id: UUID
    starts_at: datetime
    ends_at: datetime
    created_at: datetime

    @field_validator("starts_at", "ends_at", "created_at")
    @classmethod
    def normalize_timestamps_to_utc(cls, value: datetime) -> datetime:
        return _as_utc(value)
