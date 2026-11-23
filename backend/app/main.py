import os
from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Profile, User
from app.schemas import (
    AuthResponse,
    AvailabilityCreate,
    AvailabilityResponse,
    GoalCreate,
    GoalResponse,
    GoalStatusUpdate,
    GoalUpdateCreate,
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdate,
    RecommendationResponse,
    RegisterRequest,
    SessionCreate,
    SessionResponse,
    SessionStatusUpdate,
    UserCreate,
    UserResponse,
)
from app.seed_demo_data import DEMO_USERS
from app.services.auth import (
    create_access_token,
    hash_password,
    read_access_token,
    verify_password,
)
from app.services.mentorship import (
    add_goal_update,
    create_availability,
    create_goal,
    create_session,
    delete_availability,
    list_availability,
    list_goals,
    list_sessions,
    update_goal_status,
    update_session_status,
)
from app.services.recommendation_service import get_recommendations
from app.services.resume_extractor import (
    MAX_RESUME_BYTES,
    ResumeExtractionError,
    extract_resume_text,
)


app = FastAPI(
    title="Mentor Match API",
    description="Backend API for graduate-to-mentor recommendations.",
    version="0.1.0",
)
frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer_auth = HTTPBearer(auto_error=False)
DEMO_ACCOUNT_IDS = frozenset(UUID(user["id"]) for user in DEMO_USERS)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Report that the API process is responding."""
    return {"status": "ok"}


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text if user.profile else "",
        career_goals=user.profile.career_goals if user.profile else "",
    )


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id), user=_user_response(user)
    )


@app.post(
    "/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_account(
    account_data: RegisterRequest, db: Session = Depends(get_db)
) -> AuthResponse:
    """Register a user, or let an existing passwordless local profile be claimed."""
    normalized_email = account_data.email.lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is not None:
        if user.password_hash is not None:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists"
            )
        if user.id in DEMO_ACCOUNT_IDS:
            raise HTTPException(
                status_code=409,
                detail="Demo accounts use the shared demo password and cannot be claimed",
            )
        user.password_hash = hash_password(account_data.password)
        db.commit()
        db.refresh(user)
        return _auth_response(user)

    user = User(
        name=account_data.name,
        email=normalized_email,
        role=account_data.role,
        password_hash=hash_password(account_data.password),
        profile=Profile(
            profile_text=account_data.profile_text,
            career_goals=account_data.career_goals,
        ),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="An account with this email already exists"
        ) from error
    db.refresh(user)
    return _auth_response(user)


@app.post("/auth/login", response_model=AuthResponse)
def login(account_data: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == account_data.email.lower()))
    password_valid = verify_password(
        account_data.password, user.password_hash if user else None
    )
    if user is None or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _auth_response(user)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_auth),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = read_access_token(credentials.credentials)
    except (InvalidTokenError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@app.post("/auth/password")
def change_password(
    password_data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.password_hash = hash_password(password_data.new_password)
    db.commit()
    return {"detail": "Password changed successfully"}


@app.get("/auth/me", response_model=UserResponse)
def get_current_account(current_user: User = Depends(get_current_user)) -> UserResponse:
    return _user_response(current_user)


def _require_read_access(user_id: UUID, current_user: User) -> None:
    if user_id != current_user.id and user_id not in DEMO_ACCOUNT_IDS:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own account and demo accounts",
        )


def _require_write_access(user_id: UUID, current_user: User) -> None:
    is_read_only_demo_graduate = (
        user_id in DEMO_ACCOUNT_IDS and current_user.role != "mentor"
    )
    if user_id != current_user.id or is_read_only_demo_graduate:
        raise HTTPException(
            status_code=403,
            detail="You can only change your own account; demo graduates are read-only",
        )


def _require_self_account(user_id: UUID, current_user: User) -> None:
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only change your own records")


def create_user(user_data: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """Create a graduate or mentor and their initial text profile."""
    user = User(
        name=user_data.name,
        email=user_data.email.lower(),
        role=user_data.role,
        profile=Profile(
            profile_text=user_data.profile_text,
            career_goals=user_data.career_goals,
        ),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        ) from error

    db.refresh(user)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text,
        career_goals=user.profile.career_goals,
    )


def get_user(user_id: UUID, db: Session = Depends(get_db)) -> UserResponse:
    user = db.scalar(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text if user.profile else "",
        career_goals=user.profile.career_goals if user.profile else "",
    )


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    _require_read_access(user_id, current_user)
    return get_user(user_id, db)


def update_profile(
    user_id: UUID,
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
) -> UserResponse:
    user = db.scalar(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.profile is None:
        user.profile = Profile()
    if profile_data.profile_text is not None:
        user.profile.profile_text = profile_data.profile_text
    if profile_data.career_goals is not None:
        user.profile.career_goals = profile_data.career_goals

    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text,
        career_goals=user.profile.career_goals,
    )


@app.put("/users/{user_id}/profile", response_model=UserResponse)
def update_profile_endpoint(
    user_id: UUID,
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    _require_write_access(user_id, current_user)
    return update_profile(user_id, profile_data, db)


def recommend_mentors(
    graduate_id: UUID,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Rank stored mentor profiles for a graduate."""
    return get_recommendations(db, graduate_id)


@app.get(
    "/users/{graduate_id}/recommendations",
    response_model=list[RecommendationResponse],
)
def recommend_mentors_endpoint(
    graduate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_read_access(graduate_id, current_user)
    return recommend_mentors(graduate_id, db)


@app.get("/users/{user_id}/goals", response_model=list[GoalResponse])
def get_goals_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GoalResponse]:
    _require_read_access(user_id, current_user)
    return list_goals(db, user_id)


@app.post(
    "/users/{user_id}/goals",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_goal_endpoint(
    user_id: UUID,
    goal_data: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    _require_self_account(user_id, current_user)
    return create_goal(db, user_id, goal_data)


@app.post(
    "/users/{user_id}/goals/{goal_id}/updates", response_model=GoalResponse
)
def add_goal_update_endpoint(
    user_id: UUID,
    goal_id: UUID,
    update_data: GoalUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    _require_self_account(user_id, current_user)
    return add_goal_update(db, user_id, goal_id, update_data)


@app.patch(
    "/users/{user_id}/goals/{goal_id}", response_model=GoalResponse
)
def update_goal_status_endpoint(
    user_id: UUID,
    goal_id: UUID,
    status_data: GoalStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    _require_self_account(user_id, current_user)
    return update_goal_status(db, user_id, goal_id, status_data)


@app.get("/users/{user_id}/sessions", response_model=list[SessionResponse])
def get_sessions_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionResponse]:
    _require_read_access(user_id, current_user)
    return list_sessions(db, user_id)


@app.get("/users/{mentor_id}/availability", response_model=list[AvailabilityResponse])
def get_mentor_availability_endpoint(
    mentor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AvailabilityResponse]:
    return list_availability(db, mentor_id)


@app.post("/users/{user_id}/availability", response_model=AvailabilityResponse, status_code=201)
def create_availability_endpoint(
    user_id: UUID,
    availability_data: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AvailabilityResponse:
    _require_write_access(user_id, current_user)
    return create_availability(db, user_id, availability_data)


@app.delete("/users/{user_id}/availability/{slot_id}", status_code=204)
def delete_availability_endpoint(
    user_id: UUID,
    slot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_write_access(user_id, current_user)
    delete_availability(db, user_id, slot_id)


@app.post(
    "/users/{user_id}/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session_endpoint(
    user_id: UUID,
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    _require_self_account(user_id, current_user)
    return create_session(db, user_id, session_data)


@app.patch("/sessions/{session_id}", response_model=SessionResponse)
def update_session_endpoint(
    session_id: UUID,
    status_data: SessionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    return update_session_status(db, session_id, current_user.id, status_data)


async def upload_resume(
    user_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Extract a PDF or DOCX resume and replace the profile text with it."""
    user = db.scalar(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        content = await file.read(MAX_RESUME_BYTES + 1)
        if len(content) > MAX_RESUME_BYTES:
            raise HTTPException(
                status_code=413, detail="Resume must be 10 MB or smaller"
            )
        extracted_text = extract_resume_text(file.filename or "", content)
    except ResumeExtractionError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        await file.close()

    if user.profile is None:
        user.profile = Profile()
    user.profile.profile_text = extracted_text
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text,
        career_goals=user.profile.career_goals,
    )


@app.post("/users/{user_id}/resume", response_model=UserResponse)
async def upload_resume_endpoint(
    user_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    _require_write_access(user_id, current_user)
    return await upload_resume(user_id, file, db)
