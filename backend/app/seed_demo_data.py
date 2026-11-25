"""Create repeatable demo mentors and mentees across several career paths."""
from datetime import datetime, time, timedelta, timezone
import os
from uuid import UUID
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine, init_db
from app.models import (
    GoalUpdate,
    MenteeGoal,
    MentorAvailability,
    MentorshipSession,
    Profile,
    User,
)
from app.services.auth import hash_password
from app.services.recommendation_service import (
    get_recommendations,
    sync_profile_skills,
)

# Development-only credential shared by the seeded demo accounts.
DEMO_PASSWORD = "MentorMatchDemo2026!"

DEMO_GOALS = (
    ("20000000-0000-4000-8000-000000000001", "Build and deploy a portfolio API", "Publish a FastAPI portfolio project using PostgreSQL.", 50, True),
    ("20000000-0000-4000-8000-000000000001", "Practice technical interviews", "Complete backend interview exercises and system-design questions.", 25, False),
    ("20000000-0000-4000-8000-000000000002", "Complete a data-science portfolio", "Build two predictive-analysis projects with documented results.", 40, True),
    ("20000000-0000-4000-8000-000000000003", "Study cloud security fundamentals", "Review identity, networking, logging, and incident-response concepts.", 30, True),
    ("20000000-0000-4000-8000-000000000004", "Build an accessible React application", "Create a responsive application using semantic HTML and keyboard testing.", 60, True),
    ("20000000-0000-4000-8000-000000000005", "Complete financial modeling exercises", "Practice forecasting, valuation, and spreadsheet analysis.", 35, False),
)


def require_local_database() -> None:
    """Allow demo seeding only on SQLite or a loopback PostgreSQL instance."""
    database_url = os.getenv("DATABASE_URL", "")
    parsed = urlparse(database_url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme.startswith("sqlite"):
        return
    if host not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError(
            "Demo seeding is restricted to SQLite or loopback PostgreSQL. "
            "The configured database host is not local."
        )

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
        "id": "10000000-0000-4000-8000-000000000005",
        "name": "Fatima Njoroge",
        "email": "fatima.mentor@example.test",
        "role": "mentor",
        "profile_text": "Frontend engineer building responsive web applications with React, JavaScript, and TypeScript. Focuses on accessibility, user interface development, testing, and design systems.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000006",
        "name": "Samuel Kariuki",
        "email": "samuel.mentor@example.test",
        "role": "mentor",
        "profile_text": "Financial analyst in fintech with experience in finance, accounting, Excel, SQL, financial modeling, risk analysis, and business intelligence.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000007",
        "name": "Wanjiru Muthoni",
        "email": "wanjiru.mentor@example.test",
        "role": "mentor",
        "profile_text": "Agricultural data scientist working with agriculture, Python, pandas, SQL, data analysis, machine learning, and data pipelines to improve crop yields.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000008",
        "name": "James Ouma",
        "email": "james.mentor@example.test",
        "role": "mentor",
        "profile_text": "Healthcare informatics specialist who builds health data systems using Python, SQL, data analytics, and business intelligence while protecting patient privacy.",
        "career_goals": "",
    },
    {
        "id": "10000000-0000-4000-8000-000000000009",
        "name": "Joseph Kamau",
        "email": "joseph.mentor@example.test",
        "role": "mentor",
        "profile_text": "Project manager in education technology. Leads agile and scrum teams, product roadmaps, stakeholder communication, project planning, and user research.",
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
    {
        "id": "20000000-0000-4000-8000-000000000004",
        "name": "Leah Otieno",
        "email": "leah.mentee@example.test",
        "role": "graduate",
        "profile_text": "Computer science graduate with React, JavaScript, and TypeScript experience. Interested in responsive web development, accessible user interfaces, and frontend testing.",
        "career_goals": "Become a frontend engineer building accessible web applications.",
    },
    {
        "id": "20000000-0000-4000-8000-000000000005",
        "name": "Kevin Kiptoo",
        "email": "kevin.mentee@example.test",
        "role": "graduate",
        "profile_text": "Business graduate interested in finance, accounting, Excel, SQL, financial analysis, and fintech products.",
        "career_goals": "Become a financial analyst and build strong financial modeling skills.",
    },
    {
        "id": "20000000-0000-4000-8000-000000000006",
        "name": "Zawadi Abdalla",
        "email": "zawadi.mentee@example.test",
        "role": "graduate",
        "profile_text": "Agriculture graduate with statistics experience who is learning Python, pandas, SQL, data analysis, and machine learning for agricultural data.",
        "career_goals": "Use data science to improve agriculture and crop planning.",
    },
    {
        "id": "20000000-0000-4000-8000-000000000007",
        "name": "Mercy Chebet",
        "email": "mercy.mentee@example.test",
        "role": "graduate",
        "profile_text": "Health sciences graduate interested in healthcare informatics, health data, Python, SQL, data analytics, and patient privacy.",
        "career_goals": "Build a career in healthcare data analytics and informatics.",
    },
    {
        "id": "20000000-0000-4000-8000-000000000008",
        "name": "Asha Wairimu",
        "email": "asha.mentee@example.test",
        "role": "graduate",
        "profile_text": "Recent graduate interested in education technology, product planning, project management, agile, scrum, and user research.",
        "career_goals": "Become a project manager for products that improve access to education.",
    },
)


def seed_demo_data() -> tuple[int, int]:
    require_local_database()
    init_db()
    created = {"mentor": 0, "graduate": 0}
    with Session(get_engine()) as db:
        for item in DEMO_USERS:
            existing = db.scalar(select(User).where(User.email == item["email"]))
            if existing is not None:
                existing.password_hash = hash_password(DEMO_PASSWORD)
                if existing.profile is not None:
                    existing.profile.profile_text = item["profile_text"]
                    existing.profile.career_goals = item["career_goals"]
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

        now = datetime.now(timezone.utc)
        tomorrow = now.date() + timedelta(days=1)
        for mentor_index, item in enumerate(
            (entry for entry in DEMO_USERS if entry["role"] == "mentor")
        ):
            mentor_id = UUID(item["id"])
            # Varied, repeatable sample hours give demo mentees bookable slots.
            # These are demo openings, not claimed availability from real users.
            for day_offset, hour_offset in ((1, 0), (3, 1), (5, 2)):
                starts_at = datetime.combine(
                    tomorrow + timedelta(days=day_offset - 1),
                    time(hour=9 + ((mentor_index * 2 + hour_offset * 3) % 9)),
                    tzinfo=timezone.utc,
                )
                existing_opening = db.scalar(
                    select(MentorAvailability.id).where(
                        MentorAvailability.mentor_id == mentor_id,
                        MentorAvailability.starts_at == starts_at,
                    )
                )
                if existing_opening is not None:
                    continue
                db.add(
                    MentorAvailability(
                        mentor_id=mentor_id,
                        starts_at=starts_at,
                        ends_at=starts_at + timedelta(hours=1),
                    )
                )

        for graduate_id_text, title, description, progress, shared in DEMO_GOALS:
            graduate_id = UUID(graduate_id_text)
            existing_goal = db.scalar(
                select(MenteeGoal).where(
                    MenteeGoal.mentee_id == graduate_id,
                    MenteeGoal.title == title,
                )
            )
            if existing_goal is not None:
                continue
            goal = MenteeGoal(
                mentee_id=graduate_id,
                title=title,
                description=description,
                target_date=(datetime.now(timezone.utc) + timedelta(days=45)).date(),
                status="completed" if progress == 100 else "active",
                progress_percent=progress,
                shared_with_mentor=shared,
            )
            goal.updates.append(
                GoalUpdate(
                    note="Sample progress update added by the local demo seeder.",
                    progress_percent=progress,
                )
            )
            db.add(goal)

        mentee_id = UUID("20000000-0000-4000-8000-000000000001")
        mentor_id = UUID("10000000-0000-4000-8000-000000000001")
        existing_session = db.scalar(
            select(MentorshipSession).where(
                MentorshipSession.mentee_id == mentee_id,
                MentorshipSession.mentor_id == mentor_id,
            )
        )
        if existing_session is None:
            first_opening = db.scalar(
                select(MentorAvailability)
                .where(MentorAvailability.mentor_id == mentor_id)
                .order_by(MentorAvailability.starts_at)
                .limit(1)
            )
            if first_opening is not None:
                db.add(
                    MentorshipSession(
                        mentee_id=mentee_id,
                        mentor_id=mentor_id,
                        scheduled_at=first_opening.starts_at,
                        agenda="Review portfolio architecture and backend career progression.",
                        status="accepted",
                    )
                )
        db.commit()

    with Session(get_engine()) as db:
        for item in DEMO_USERS:
            user = db.scalar(
                select(User)
                .where(User.id == UUID(item["id"]))
            )
            if user is not None and user.profile is not None:
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

    # Persist a repeatable first-page recommendation snapshot for demo graduates.
    with Session(get_engine()) as db:
        for item in DEMO_USERS:
            if item["role"] == "graduate":
                get_recommendations(db, UUID(item["id"]))
    return created["mentor"], created["graduate"]


if __name__ == "__main__":
    mentors, mentees = seed_demo_data()
    print(f"Added {mentors} demo mentors and {mentees} demo mentees (existing entries kept).")
