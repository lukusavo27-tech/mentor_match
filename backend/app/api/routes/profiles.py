from fastapi import APIRouter
from app.schemas.profile import ProfileRead

router = APIRouter(prefix="/profiles", tags=["Profiles"])

@router.get("/me", response_model=ProfileRead)
def get_my_profile():
    # TODO: Replace this demo response with authenticated database lookup.
    return ProfileRead(
        id=1,
        full_name="Demo Graduate",
        role="graduate",
        education="BSc Informatics and Computer Science",
        career_interests=["Software Engineering", "Artificial Intelligence"],
        skills=["Python", "React", "PostgreSQL"],
    )

@router.put("/me")
def update_my_profile():
    # TODO: Accept a ProfileUpdate schema and persist it through SQLAlchemy.
    return {"message": "Profile update endpoint scaffolded"}
