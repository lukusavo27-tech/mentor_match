# MentorMatch Backend

FastAPI starter backend for the MentorMatch project.

## Requirements
- Python 3.10+
- PostgreSQL 14+ recommended

## Setup
From this directory:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create the PostgreSQL database:

```sql
CREATE DATABASE mentormatch;
```

Edit `DATABASE_URL` in `.env` to match your local PostgreSQL username and password.

## Run
```bash
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## Included API routes
- `GET /api/health`
- `GET /api/health/database`
- `GET /api/profiles/me` (demo response)
- `PUT /api/profiles/me` (scaffold only)
- `POST /api/matching/recommend` (TF-IDF/cosine baseline against demo mentor corpus)
- `POST /api/resumes/extract-text` (PDF text extraction)

## Current limitations
- Authentication and authorization are not implemented.
- Profile endpoints are scaffolds and do not yet persist data.
- The matching service currently uses three hard-coded demo mentor profiles.
- The score is a lexical TF-IDF/cosine baseline; it is not a trained semantic model.
- spaCy is included as a dependency, but domain-specific NER/skill extraction is still a TODO.
- SQLAlchemy database connection is configured, but database models/migrations are not yet implemented.
- Resume extraction reads selectable PDF text; scanned PDFs require OCR, which is not included.

Do not use the demo endpoints as production functionality. Implement database persistence, authentication, validation, and tests before deployment.
