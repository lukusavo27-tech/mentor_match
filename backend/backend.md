# Mentor Match Backend Manual

## What the backend does

The API stores graduate and mentor text profiles in PostgreSQL and ranks mentors
for a graduate. It returns a match score and the skills both profiles mention.

Matching runs in two parts:

1. `app/services/nlp_pipeline.py` uses spaCy to tokenize and lemmatize text. A
   curated `PhraseMatcher` normalizes known skills; spaCy's `EntityRuler`
   recognizes listed skills, job titles, industries, and qualifications.
2. `app/services/matching_engine.py` uses scikit-learn's `TfidfVectorizer` and
   cosine similarity to score and rank profiles.

TF-IDF is not performed in `nlp_pipeline.py`; that module prepares the text and
career entities. The matching service applies TF-IDF. This is rule-based entity
recognition, not a custom trained NER model. Add patterns based on representative
profiles and evaluate them; adding aliases improves vocabulary coverage but
does not teach the model new entity types.

This is a local prototype. It supports password sign-in, profile matching,
PDF/DOCX text extraction, mentee goal tracking, and basic mentorship session
requests. It does not verify email addresses, rate-limit sign-in, check mentor
availability, or prevent overlapping sessions. Keep it on a trusted development
network while using demo accounts.

## Run it locally

Run these commands from the backend directory.

### 1. Activate the virtual environment and install dependencies

```bash
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

The spaCy model command is needed once per virtual environment.

### 2. Configure PostgreSQL

Copy `.env.example` to `.env` and edit `DATABASE_URL` with your PostgreSQL role,
password, host, port, and database name. Set `MENTORMATCH_SECRET_KEY` to a
randomly generated value of at least 32 bytes. Keep `.env` private. If your
password contains URL-special characters, URL-encode them.

(MENTORMATCH_SECRET_KEY signs the login tokens the backend issues. The backend checks that signature on protected requests, so a token can’t be altered to impersonate another account.

Keep it private and use a random value of at least 32 bytes. If you change it, previously issued login tokens will stop working and users will need to sign in again.)

Create the database once if you have not already:

```bash
createdb -h localhost -U postgres mentor_match
```

Replace `postgres` with your PostgreSQL role if needed. The command prompts for
your password. Then create the tables and add the repeatable demo profiles:

```bash
python -m app.init_db
python -m app.seed_demo_data
```

`init_db` creates missing tables and adds missing `career_goals` and
`password_hash` columns to older databases. It is a small setup helper, not a
general-purpose migration system. The demo seeder assigns all seeded accounts
the local-only password `MentorMatchDemo2026!`; do not use this password outside
local development. It also adds varied sample openings for demo mentors that
do not already have availability. Rerun it after the availability table
migration to add openings to existing demo accounts; existing openings remain.

### Inspect and persist PostgreSQL records

The API writes through SQLAlchemy to the PostgreSQL database named by
`DATABASE_URL` in `backend/.env`. Committed records remain when the API or
frontend restarts. They are lost only if the database or its persistent storage
is deleted, or if records are explicitly removed. `init_db` is additive: it
creates missing tables and compatibility columns without clearing records.
The demo seeder keeps existing profiles and resets seeded demo-account passwords
to the shared local demo password.

Connect with values from your private `.env`:

```bash
psql -h localhost -p 5432 -U postgres -d mentor_match
```

Replace the host, port, username, and database with the values in
`DATABASE_URL`. `psql` prompts for the database password. In the interactive
prompt, list tables and inspect their columns:

```text
\dt
\d users
\d profiles
\d mentee_goals
\d goal_updates
\d mentorship_sessions
```

Useful read-only queries:

```sql
SELECT id, name, email, role, created_at FROM users ORDER BY role, name;

SELECT u.name, u.role, p.profile_text, p.career_goals
FROM users AS u
JOIN profiles AS p ON p.user_id = u.id
ORDER BY u.role, u.name;

SELECT id, mentee_id, title, status, progress_percent, target_date
FROM mentee_goals ORDER BY created_at DESC;

SELECT id, mentee_id, mentor_id, scheduled_at, status, agenda
FROM mentorship_sessions ORDER BY scheduled_at DESC;
```

Do not share `.env` contents; the database URL contains credentials. Tests use
temporary in-memory SQLite and do not add records to PostgreSQL.

### 3. Start the API

```bash
uvicorn app.main:app --reload
```

Keep this terminal running while using the API. Open <http://127.0.0.1:8000/docs>
to try the endpoints in your browser. Stop the server with `Ctrl+C` when done.

## Accounts and sign-in

The dashboard opens to sign-in. Register with `POST /auth/register` using a
name, email, role (`graduate` or `mentor`), and password of at least 10
characters. Sign in with `POST /auth/login`. Both return a 12-hour bearer token;
the browser stores it in local storage and sends it on protected requests.
`GET /auth/me` returns the signed-in account. **Sign out** removes the browser
token. `POST /auth/password` changes the signed-in user's password using
`current_password` and `new_password` (at least 10 characters). Password reset
emails are not implemented.

Choose a demo account at the sign-in screen, or register and sign in to your own
account. The dashboard uses the signed-in account; it does not switch into other
users' accounts after sign-in. Demo profiles can be viewed and used for matching,
but profile changes are blocked. A passwordless account created by the older
local prototype can be claimed by registering with its existing email.
Because that prototype did not verify email ownership, keep the API on a trusted
development network and do not use that claim flow for public accounts.

## Use the API

After signing in, send `Authorization: Bearer <access_token>` to profile,
recommendation, and resume endpoints.

### Create an account

In `/docs`, open `POST /auth/register`, choose **Try it out**, and submit:

```json
{
  "name": "Graduate Example",
  "email": "graduate@example.com",
  "role": "graduate",
  "password": "a-long-password-here",
  "profile_text": "Recent graduate interested in Python APIs and PostgreSQL databases.",
  "career_goals": "Become a backend engineer and build production APIs."
}
```

Copy the returned `id`; this is the graduate UUID.

### Create a mentor

Register another account with the role `mentor`:

```json
{
  "name": "Backend Mentor",
  "email": "mentor@example.com",
  "role": "mentor",
  "password": "another-long-password",
  "profile_text": "Backend engineer building Python APIs with PostgreSQL."
}
```

Add more mentors with different skills to compare their rankings.

### Get recommendations

Open `GET /users/{graduate_id}/recommendations`, select **Try it out**, and enter
the graduate UUID. Results include:

```json
[
  {
    "mentor_id": "<mentor-uuid>",
    "name": "Backend Mentor",
    "score": 0.718,
    "shared_skills": ["python", "sql"],
    "profile_text": "Backend engineer building Python APIs with PostgreSQL."
  }
]
```

Scores are for ranking within that recommendation request; they are not
probabilities of a successful mentorship. With no mentors, the endpoint returns
an empty list. Profiles with no usable text receive a score of `0.0`.

### Read or update a profile

- `GET /users/{user_id}` returns a user's role and profile text.
- `PUT /users/{user_id}/profile` updates profile text, career goals, or both.
  Example body:

```json
{
  "career_goals": "Become a data engineer."
}
```

Career goals are included in the graduate text used for matching.

### Mentee goals and progress

`career_goals` remains a free-text profile field used for matching. Graduates can
also create and track separate milestones. Goal progress updates are saved as
history, and setting progress to 100% completes the goal automatically.

- `GET /users/{user_id}/goals` lists the graduate's goals and update history.
- `POST /users/{user_id}/goals` creates a goal with a title and optional
  description and target date.
- `POST /users/{user_id}/goals/{goal_id}/updates` records a note and progress
  percentage from 0 to 100.
- `PATCH /users/{user_id}/goals/{goal_id}` pauses, resumes, or completes a goal.

Only the signed-in graduate can write their own goals. A completed goal cannot
receive more progress updates.

### Mentorship sessions

Graduates can request a session with a mentor by supplying a future,
timezone-aware date and time and an optional agenda. Session status starts as
`pending`. Mentors can accept or decline; either participant can cancel a pending
or accepted session; the mentor can mark an accepted session completed. Both
participants can list their sessions.

- `GET /users/{user_id}/sessions` lists sessions for that account.
- `POST /users/{user_id}/sessions` requests a session with `mentor_id`,
  `scheduled_at`, and optional `agenda`.
- `PATCH /sessions/{session_id}` changes `status` to `accepted`, `declined`,
  `cancelled`, or `completed`, subject to the transition rules above.

Mentors can create one-hour future availability openings. Graduates can request
only those openings; pending and accepted sessions block overlapping requests.
Mentors can accept or decline requests, either participant can cancel, and
mentors can mark accepted sessions completed. Availability, sessions, goals,
profile text, and career goals are persisted in PostgreSQL. After deploying the
availability table change, run the additive `python -m app.init_db` setup once
against the hosted database; it creates the missing table without clearing
existing records. Mentors, including demo mentors, can edit their own profiles
and availability. Demo graduate profiles remain read-only; signed-in demo
graduates can create goals and request sessions for evaluation.
Availability is listed with `GET /users/{mentor_id}/availability`, created with
`POST /users/{mentor_id}/availability`, and removed with
`DELETE /users/{mentor_id}/availability/{slot_id}`.

### Frontend connection status

The React app is in the sibling `new-frontend` directory. In local development,
Vite proxies `/auth`, `/users`, and `/health` to FastAPI on port 8000. Keep
`VITE_API_BASE_URL` empty for that proxy setup; adding `/api` is incorrect because
the backend routes start at `/auth`, `/users`, and `/health`. A separately hosted
frontend needs a full backend URL and backend CORS configuration, which this
prototype does not currently provide.

## Run the automated tests

From the backend directory:

```bash
python -m unittest discover -s tests -v
```

The tests use temporary in-memory SQLite databases, not your PostgreSQL
database. They cover registration and login, access restrictions, profile
operations, the existing-table migrations, resume extraction, recommendations
influenced by career goals, rule-based entity extraction, goal progress and
session status transitions, and a small labeled top-one matching evaluation.
The current four-profile fixture scores Precision@1, Recall@1, and F1@1 at 1.0.
This is a smoke check, not final research evidence; use more profiles with
relevance labels reviewed by people familiar with the careers being matched for
capstone results.

## Resume uploads

The dashboard provides the file picker and sends the file to
`POST /users/{user_id}/resume`. The API accepts PDF and DOCX files up to 10 MB,
extracts readable text, and replaces profile text while preserving career goals.
The extracted text is stored in the PostgreSQL profile and remains editable;
the uploaded binary is processed in memory and discarded. Image-only or
password-protected PDFs are not supported.

## Current limitations

- Authentication is intended for local evaluation. There is no email
  verification, password reset email, sign-in rate limiting, or production
  session revocation. Tokens expire after 12 hours.
- The curated skill and career-entity lists do not cover every career or
  synonym. TF-IDF scores rank profiles; they are not probabilities or evidence
  that a mentorship will succeed. The labeled evaluation fixture is too small
  to support broad performance claims.
- Resume extraction accepts PDF and DOCX text up to 10 MB. It has no OCR for
  image-only documents and no malware scanning.
- Session requests check mentor availability and overlapping pending or
  accepted sessions. The API does not send calendar invitations or reminders.
- `init_db` is a small development helper, not a general migration framework.
  Use versioned migrations before evolving a production schema.
- Local Vite proxying is configured; a separately deployed frontend still needs
  HTTPS, an explicit API URL, and CORS configuration.

## Troubleshooting

- **`DATABASE_URL is not set`:** create `.env` from `.env.example` and set the
  connection URL.
- **Database connection error:** confirm PostgreSQL is running, the database
  exists, and the role/password in `.env` are correct.
- **`en_core_web_sm` not found:** activate the project virtual environment and
  run `python -m spacy download en_core_web_sm`.
- **Port 8000 is busy:** stop the other server or run
  `uvicorn app.main:app --reload --port 8001`.
