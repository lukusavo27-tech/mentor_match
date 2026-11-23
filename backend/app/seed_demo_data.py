"""Create repeatable local demo mentors and mentees."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine, init_db
from app.models import Profile, User
from app.services.auth import hash_password

# Development-only credential shared by the seeded demo accounts.
DEMO_PASSWORD = "MentorMatchDemo2026!"

DEMO_USERS = (
    {
        "id": "10000000-0000-4000-8000-000000000001",
        "name": "Grace Wanjiku",
        "email": "grace.mentor@example.test",
        "role": "mentor",
        "profile_text": "Senior software engineer with 9 years building Python APIs, PostgreSQL databases, cloud platforms, and scalable systems. Mentors early career backend developers.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000002",
        "name": "David Mwangi",
        "email": "david.mentor@example.test",
        "role": "mentor",
        "profile_text": "Data scientist and AI lead specializing in machine learning, Python, analytics, data engineering, and responsible AI deployments.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000003",
        "name": "Amina Hassan",
        "email": "amina.mentor@example.test",
        "role": "mentor",
        "profile_text": "Product manager with experience in product strategy, user research, UX design, roadmaps, stakeholder management, and leadership.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000004",
        "name": "Peter Otieno",
        "email": "peter.mentor@example.test",
        "role": "mentor",
        "profile_text": "Cybersecurity analyst and cloud security engineer. Works with AWS, incident response, network security, risk assessment, and compliance.",
        "career_goals": "",
    },
    {
        "id": "20000000-0000-4000-8000-000000000001",
        "name": "Tillen Otuoma",
        "email": "tillen.mentee@example.test",
        "role": "graduate",
        "profile_text": "Informatics and computer science graduate. Skills include React, Python, and PostgreSQL.",
        "career_goals": "Become a backend software engineer and build scalable cloud applications.",
    },
    {
        "id": "20000000-0000-4000-8000-000000000002",
        "name": "Njeri Kamau",
        "email": "njeri.mentee@example.test",
        "role": "graduate",
        "profile_text": "Recent mathematics graduate interested in statistics, Python, SQL, and data analysis.",
        "career_goals": "Start a career in data science and machine learning.",
    },
    {
        "id": "20000000-0000-4000-8000-000000000003",
        "name": "Brian Kiptoo",
        "email": "brian.mentee@example.test",
        "role": "graduate",
        "profile_text": "Information technology graduate with networking fundamentals and an interest in cloud infrastructure.",
        "career_goals": "Become a cybersecurity analyst specializing in cloud security.",
    },
)


def seed_demo_data() -> tuple[int, int]:
    init_db()
    created = {"mentor": 0, "graduate": 0}
    with Session(get_engine()) as db:
        for item in DEMO_USERS:
            existing = db.scalar(select(User).where(User.email == item["email"]))
            if existing is not None:
                existing.password_hash = hash_password(DEMO_PASSWORD)
                continue
            user = User(
                id=UUID(item["id"]),
                name=item["name"],
                email=item["email"],
                role=item["role"],
                password_hash=hash_password(DEMO_PASSWORD),
                profile=Profile(
                    profile_text=item["profile_text"],
                    career_goals=item["career_goals"],
                ),
            )
            db.add(user)
            created[item["role"]] += 1
        db.commit()
    return created["mentor"], created["graduate"]


if __name__ == "__main__":
    mentors, mentees = seed_demo_data()
    print(f"Added {mentors} demo mentors and {mentees} demo mentees (existing entries kept).")
