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
PDF/DOCX text extraction, mentee goal tracking, mentorship session requests,
and basic administrator account management. Session requests check published
mentor availability and prevent overlapping pending or accepted sessions. It
does not verify email addresses or rate-limit sign-in. Keep it on a trusted
development network while using demo accounts.

## Run it locally

Run these commands from the backend directory.

### Quick start

After creating `.venv` and installing the dependencies below, start the backend with:

```bash
./run_local.sh
```

The script ignores `.env`, uses the local `mentor_match_local.db` SQLite file,
and creates a persistent local signing key under your user config directory.
It migrates an existing local database, or creates and seeds a new one. Use
`./run_local.sh --bootstrap-admin` once if you need to create a local admin;
it prompts for credentials. Use `--seed` only when you intentionally want to
rerun the demo seeder. Start the frontend separately with `npm run dev` from
`new-frontend`.

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
your password. On a new, empty database, apply the schema and add demo profiles:

```bash
python -m app.init_db
python -m app.seed_demo_data
```

`python -m app.init_db` applies the Alembic migration chain to an empty database.
The demo seeder assigns all seeded accounts
the local-only password `MentorMatchDemo2026!`; do not use this password outside
local development. It also adds varied sample openings for demo mentors that
do not already have availability. Rerun it after the availability table
migration to add openings to existing demo accounts; existing openings remain.

### Database migration workflow

Schema changes are versioned in `migrations/versions`. For a new, empty database,
run `python -m app.init_db` or `alembic upgrade head`. Existing databases created
before Alembic have no migration history and are deliberately not upgraded
automatically.

The `legacy_baseline` revision describes the existing schema immediately before
the admin flags. For an existing database, use the guarded workflow below. It
compares the schema and verifies a fresh backup before recording migration
history. Do not run a bare `alembic stamp` against a hosted database: stamping
records a revision without checking or changing the schema. In this workspace
`.env` may point to the production database.

#### Scripted PostgreSQL preflight, backup, and adoption

For an existing PostgreSQL database, use `scripts/db_safety.py` rather than
manually composing stamp and upgrade commands. It derives the expected schema
by executing the frozen `legacy_baseline` migration in an in-memory database,
then compares the target's tables, columns, types, nullability, defaults,
primary and unique keys, indexes, foreign keys, and check constraints.

The script reads only `MENTORMATCH_TARGET_DATABASE_URL`; it does not load
`.env`. Set the URL from the Render PostgreSQL connection details without
printing it or committing it. PostgreSQL client tools (`pg_dump` and
`pg_restore`) are required for backup and adoption:

```bash
read -rsp 'Target PostgreSQL URL: ' MENTORMATCH_TARGET_DATABASE_URL
printf '\n'
export MENTORMATCH_TARGET_DATABASE_URL
python scripts/db_safety.py preflight
```

The preflight is read-only. The known earlier Render schema may be reported as
recognized, with four planned additions: `profiles.resume_text`,
`mentee_goals.shared_with_mentor`, and the `profile_skills` and
`recommendations` tables. The adoption command applies those additions only
after a fresh backup and exact-target confirmation. It leaves existing rows in
place, gives old profiles an empty resume text and old goals a private sharing
default, and creates the two cache tables empty; it does not enter or reseed
profile data. If preflight reports any other difference, stop and review it;
do not adopt.

To create a compressed custom-format dump, validate that PostgreSQL can read
its archive directory, and write a SHA-256 manifest, choose a backup directory
outside this project:

```bash
mkdir -p "$HOME/mentor_match_backups"
python scripts/db_safety.py backup --directory "$HOME/mentor_match_backups"
```

The backup command can still create an archive when preflight finds a schema
mismatch; its manifest records the mismatch and the archive cannot be used by
the adoption command. Archive listing and checksum verification detect an
incomplete or altered dump, but a restore rehearsal to a separate database is
stronger verification and should be done before a production change. A full
dump reads and transfers all database contents, so consider the database load
and any applicable network or storage costs. Backup files are created with
owner-only permissions; store them on a protected or encrypted volume.

Only after reviewing a passing preflight and choosing an appropriate backup
location, adoption can be run with:

```bash
python scripts/db_safety.py adopt --directory "$HOME/mentor_match_backups"
```

Adoption repeats the schema check, creates and validates a fresh backup,
requires typing the exact host/database identity, aligns the recognized older
schema if needed, stamps `legacy_baseline`, upgrades to `head`, and runs
Alembic's metadata check. It does not seed data. The operation changes schema
metadata and applies migrations; it is not part of local startup. Do not run
adoption until the target and backup have been reviewed.

After the workflow, clear the connection URL from the shell with
`unset MENTORMATCH_TARGET_DATABASE_URL`.

### Administrator account setup

Public registration only creates graduate or mentor accounts. To create the
first administrator on a local database, run:

```bash
python -m app.bootstrap_admin
```

The command prompts for account details and applies pending migrations before
creating the account. Administrator access is a separate flag; public
registration still offers only graduate or mentor, and the database role
remains `graduate` to preserve the existing role constraint. The admin screen is
at `/admin`; the client verifies `/auth/me` before rendering it, and backend
admin endpoints enforce the privilege independently.

The command refuses remote databases unless explicitly confirmed with
`--allow-remote`. **Do not use that option against a hosted/production database
until the target and schema change are deliberately reviewed.** Existing
unversioned databases must first be verified and stamped at the baseline as
described above. Never paste or print a database URL containing credentials
while checking the target.

Administrators can view summary counts, search/filter accounts,
suspend/reactivate accounts, and permanently delete accounts with their related
profile, goals, sessions, availability, and recommendations. Suspension
prevents future sign-ins and rejects existing tokens on their next request. The
UI prevents an administrator from suspending or deleting their own account;
the API also protects against self-removal and removal of the last active
administrator. Deletion is permanent and is not audit-logged, so use suspension
when reversible action is appropriate.

### Inspect and persist PostgreSQL records

The API writes through SQLAlchemy to the PostgreSQL database named by
`DATABASE_URL` in `backend/.env`. Committed records remain when the API or
frontend restarts. They are lost only if the database or its persistent storage
is deleted, or if records are explicitly removed. New databases are built from
versioned migrations. Existing databases must be explicitly adopted at the
baseline before the migration runner will modify them.
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
- Graduates can opt a goal into mentor sharing when creating or updating it.
- `GET /users/{mentor_id}/shared-goals` lists opted-in goals only for the signed-in
  mentor's graduates with an accepted or completed mentorship session.

Only the signed-in graduate can write their own goals. Existing databases
require baseline adoption before running later schema migrations; the
`legacy_baseline` already includes the goal-sharing flag.
Sharing can be turned off at any time. Pending, declined, or cancelled sessions do not grant goal access.
A completed goal cannot receive more progress updates.

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
profile text, and career goals are persisted in PostgreSQL. The
`legacy_baseline` includes the availability table; existing databases require
verified baseline adoption before new migrations. Mentors, including demo mentors, can edit their own profiles
and availability. Demo graduate profiles remain read-only; signed-in demo
graduates can create goals and request sessions for evaluation.
Availability is listed with `GET /users/{mentor_id}/availability`, created with
`POST /users/{mentor_id}/availability`, and removed with
`DELETE /users/{mentor_id}/availability/{slot_id}`.

### Frontend connection status

The React app is in the sibling `new-frontend` directory. In local development,
Vite proxies `/auth`, `/users`, `/admin/*` API endpoints, and `/health` to
FastAPI on port 8000. The `/admin` page path is handled by React. Keep
`VITE_API_BASE_URL` empty for that proxy setup; adding `/api` is incorrect because
the backend routes start at `/auth`, `/users`, `/admin`, and `/health`. A
separately hosted frontend needs a full backend URL and backend CORS
configuration, which this prototype does not currently provide.

## Run the automated tests

From the backend directory:

```bash
python -m unittest discover -s tests -v
```

The tests use temporary SQLite databases, not your PostgreSQL database. They
cover fresh and legacy Alembic upgrades, preservation of existing rows,
registration and login, access restrictions, profile operations, resume extraction, recommendations
influenced by career goals, rule-based entity extraction, goal progress and
session status transitions, administrator access and account lifecycle, and a
small labeled top-one matching evaluation.
The current four-profile fixture scores Precision@1, Recall@1, and F1@1 at 1.0.
This is a smoke check, not final research evidence; use more profiles with
relevance labels reviewed by people familiar with the careers being matched for
capstone results.

## Resume uploads

The dashboard provides the file picker and sends the file to
`POST /users/{user_id}/resume`. The API accepts PDF and DOCX files up to 10 MB,
extracts readable text, and stores it separately from the editable profile text
and career goals. All three text sources contribute to matching, with exact
duplicate inputs counted once. The extracted text is stored in the PostgreSQL
profile; the uploaded binary is processed in memory and discarded. Image-only
or password-protected PDFs are not supported.

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
- Existing databases have to be checked against `legacy_baseline` and explicitly
  stamped before Alembic can upgrade them. Never stamp an unverified schema.
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
