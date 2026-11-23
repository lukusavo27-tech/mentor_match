"""Create repeatable demo mentors and mentees across several career paths."""
from datetime import datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_engine, init_db
from app.models import MentorAvailability, Profile, User
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

        now = datetime.now(timezone.utc)
        tomorrow = now.date() + timedelta(days=1)
        for mentor_index, item in enumerate(
            (entry for entry in DEMO_USERS if entry["role"] == "mentor")
        ):
            mentor_id = UUID(item["id"])
            existing_opening = db.scalar(
                select(MentorAvailability.id)
                .where(MentorAvailability.mentor_id == mentor_id)
                .limit(1)
            )
            if existing_opening is not None:
                continue
            # Varied, repeatable sample hours give demo mentees bookable slots.
            # These are demo openings, not claimed availability from real users.
            for day_offset, hour_offset in ((1, 0), (3, 1), (5, 2)):
                starts_at = datetime.combine(
                    tomorrow + timedelta(days=day_offset - 1),
                    time(hour=9 + ((mentor_index * 2 + hour_offset * 3) % 9)),
                    tzinfo=timezone.utc,
                )
                db.add(
                    MentorAvailability(
                        mentor_id=mentor_id,
                        starts_at=starts_at,
                        ends_at=starts_at + timedelta(hours=1),
                    )
                )
        db.commit()
    return created["mentor"], created["graduate"]


if __name__ == "__main__":
    mentors, mentees = seed_demo_data()
    print(f"Added {mentors} demo mentors and {mentees} demo mentees (existing entries kept).")
