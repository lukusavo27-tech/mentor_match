import os
from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    GoalUpdate,
    MenteeGoal,
    MentorAvailability,
    MentorshipSession,
    Profile,
    ProfileSkill,
    Recommendation,
    User,
)
from app.schemas import (
    AdminSummary,
    AdminUserResponse,
    AdminUserStatusUpdate,
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
    list_shared_goals,
    list_sessions,
    update_goal_status,
    update_session_status,
)
from app.services.recommendation_service import (
    get_recommendations,
    sync_profile_skills,
)
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
        resume_text=user.profile.resume_text if user.profile else "",
        is_admin=user.is_admin,
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
        if not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="Email or password is incorrect",
                headers={"WWW-Authenticate": "Bearer"},
            )
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
        if user.profile is not None:
            sync_profile_skills(
                db,
                user.profile,
                "\n".join(
                    part
                    for part in (
                        user.profile.resume_text,
                        user.profile.profile_text,
                        user.profile.career_goals,
                    )
                    if part
                ),
            )
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
    if user.profile is not None:
        sync_profile_skills(
            db,
            user.profile,
            "\n".join(
                part
                for part in (user.profile.profile_text, user.profile.career_goals)
                if part
            ),
        )
    return _auth_response(user)


@app.post("/auth/login", response_model=AuthResponse)
def login(account_data: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == account_data.email.lower()))
    password_valid = verify_password(
        account_data.password, user.password_hash if user else None
    )
    if user is None or not password_valid or not user.is_active:
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
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account is suspended",
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


def _require_admin(current_user: User) -> None:
    if not current_user.is_admin or not current_user.is_active:
        raise HTTPException(status_code=403, detail="Administrator access is required")


def _prevent_unsafe_admin_change(
    db: Session, target: User, current_user: User
) -> None:
    if target.id == current_user.id:
        raise HTTPException(
            status_code=409, detail="You cannot disable or delete your own account"
        )
    if target.is_admin and target.is_active:
        active_admins = db.scalars(
            select(User)
            .where(User.is_admin.is_(True), User.is_active.is_(True))
            .order_by(User.id)
            .with_for_update()
        ).all()
        if len(active_admins) <= 1:
            raise HTTPException(
                status_code=409,
                detail="The last active administrator cannot be disabled or deleted",
            )


@app.get("/admin/summary", response_model=AdminSummary)
def admin_summary_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminSummary:
    _require_admin(current_user)
    return AdminSummary(
        total_users=db.scalar(select(func.count(User.id))) or 0,
        active_users=db.scalar(
            select(func.count(User.id)).where(User.is_active.is_(True))
        ) or 0,
        suspended_users=db.scalar(
            select(func.count(User.id)).where(User.is_active.is_(False))
        ) or 0,
        graduates=db.scalar(
            select(func.count(User.id)).where(
                User.role == "graduate", User.is_admin.is_(False)
            )
        ) or 0,
        mentors=db.scalar(
            select(func.count(User.id)).where(
                User.role == "mentor", User.is_admin.is_(False)
            )
        ) or 0,
        pending_sessions=db.scalar(
            select(func.count(MentorshipSession.id)).where(
                MentorshipSession.status == "pending"
            )
        ) or 0,
    )


@app.get("/admin/users", response_model=list[AdminUserResponse])
def admin_list_users_endpoint(
    search: str = "",
    role: str | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AdminUserResponse]:
    _require_admin(current_user)
    search = search.strip()
    if len(search) > 100 or offset < 0 or not 1 <= limit <= 100:
        raise HTTPException(
            status_code=422, detail="Invalid search or pagination values"
        )
    if role is not None and role not in {"graduate", "mentor"}:
        raise HTTPException(status_code=422, detail="Role must be graduate or mentor")

    query = select(User)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(User.name.ilike(pattern), User.email.ilike(pattern))
        )
    if role is not None:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))
    users = db.scalars(
        query.order_by(User.created_at.desc(), User.id).offset(offset).limit(limit)
    ).all()
    return [
        AdminUserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_admin=user.is_admin,
            is_active=user.is_active,
            created_at=user.created_at,
        )
        for user in users
    ]


@app.patch("/admin/users/{user_id}/status", response_model=AdminUserResponse)
def admin_update_user_status_endpoint(
    user_id: UUID,
    status_data: AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminUserResponse:
    _require_admin(current_user)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not status_data.is_active:
        _prevent_unsafe_admin_change(db, target, current_user)
    target.is_active = status_data.is_active
    db.commit()
    db.refresh(target)
    return AdminUserResponse.model_validate(target, from_attributes=True)


@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_admin(current_user)
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    _prevent_unsafe_admin_change(db, target, current_user)
    db.execute(
        delete(Recommendation).where(
            or_(
                Recommendation.graduate_id == user_id,
                Recommendation.mentor_id == user_id,
            )
        )
    )
    db.execute(
        delete(MentorshipSession).where(
            or_(
                MentorshipSession.mentee_id == user_id,
                MentorshipSession.mentor_id == user_id,
            )
        )
    )
    db.execute(delete(MentorAvailability).where(MentorAvailability.mentor_id == user_id))
    goal_ids = select(MenteeGoal.id).where(MenteeGoal.mentee_id == user_id)
    db.execute(delete(GoalUpdate).where(GoalUpdate.goal_id.in_(goal_ids)))
    db.execute(delete(MenteeGoal).where(MenteeGoal.mentee_id == user_id))
    if target.profile is not None:
        db.execute(delete(ProfileSkill).where(ProfileSkill.profile_id == target.profile.id))
        db.delete(target.profile)
    db.delete(target)
    db.commit()


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
    sync_profile_skills(db, user.profile, "\n".join(
        part for part in (
            user.profile.profile_text,
            user.profile.career_goals,
        ) if part
    ))
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text,
        career_goals=user.profile.career_goals,
        resume_text=user.profile.resume_text,
        is_admin=user.is_admin,
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
        resume_text=user.profile.resume_text if user.profile else "",
        is_admin=user.is_admin,
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
    sync_profile_skills(db, user.profile, "\n".join(
        part for part in (
            user.profile.resume_text,
            user.profile.profile_text,
            user.profile.career_goals,
        ) if part
    ))
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text,
        career_goals=user.profile.career_goals,
        resume_text=user.profile.resume_text,
        is_admin=user.is_admin,
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
    available_only: bool = False,
) -> list[dict]:
    """Rank stored mentor profiles for a graduate."""
    return get_recommendations(db, graduate_id, available_only=available_only)


@app.get(
    "/users/{graduate_id}/recommendations",
    response_model=list[RecommendationResponse],
)
def recommend_mentors_endpoint(
    graduate_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    available_only: bool = False,
) -> list[dict]:
    _require_read_access(graduate_id, current_user)
    return recommend_mentors(graduate_id, db, available_only)


@app.get("/users/{user_id}/goals", response_model=list[GoalResponse])
def get_goals_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GoalResponse]:
    _require_read_access(user_id, current_user)
    return list_goals(db, user_id)


@app.get("/users/{mentor_id}/shared-goals", response_model=list[GoalResponse])
def get_shared_goals_endpoint(
    mentor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GoalResponse]:
    _require_self_account(mentor_id, current_user)
    if current_user.role != "mentor":
        raise HTTPException(status_code=403, detail="Only mentors can view shared goals")
    return list_shared_goals(db, mentor_id)


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
    """Extract a PDF or DOCX resume into its own profile field."""
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
    user.profile.resume_text = extracted_text
    db.commit()
    db.refresh(user)
    sync_profile_skills(db, user.profile, "\n".join(
        part for part in (
            user.profile.resume_text,
            user.profile.profile_text,
            user.profile.career_goals,
        ) if part
    ))
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        profile_text=user.profile.profile_text,
        career_goals=user.profile.career_goals,
        resume_text=user.profile.resume_text,
        is_admin=user.is_admin,
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
