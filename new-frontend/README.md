# MentorMatch Frontend

React, Vite, and Tailwind CSS frontend for the MentorMatch backend. It keeps the
existing MentorMatch dashboard theme and connects the screens to FastAPI.

## Run locally

Start PostgreSQL and the backend first. From the backend directory:

```bash
source venv/bin/activate
uvicorn app.main:app --reload
```

In a second terminal, from `new-frontend`:

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/auth`, `/users`, the `/admin/*` API
endpoints, and `/health` to FastAPI at `http://localhost:8000`. The `/admin`
page itself is served by React. Keep `VITE_API_BASE_URL` empty for local
development. The backend has no `/api` route prefix. Restart Vite after changing
`.env` because Vite reads it at startup.

## Sign in and use the dashboard

The sign-in screen lets you select a seeded demo account or register a new
account. Seeded demo accounts use the local-only password
`MentorMatchDemo2026!`. After sign-in, the dashboard stays on that account;
signing out returns to the login screen.

The dashboard supports profile editing, separate PDF/DOCX resume text, live mentor
recommendations, goal progress history, opt-in goal sharing with a mentor after
an accepted or completed session, session requests and responses, and password
changes. Administrators can search accounts, suspend/reactivate accounts, and
permanently delete an account and related records. Admin provisioning is done
from the backend and is not available through public registration. A graduate
can request a session from a
mentor card or from the Sessions page. Mentors can accept or decline requests.
The dedicated `/admin` route verifies the signed-in account with the backend;
the route and admin navigation are not shown to ordinary accounts.

Build and preview:

```bash
npm run build
npm run preview
```

## Current limitations

- This frontend is for local evaluation. Do not use the shared demo password
  for real accounts.
- Demo profile fields are read-only. Use a registered account to save profile
  changes, upload a resume, or change that account's password.
- Recommendations come from the backend's small rule-based career vocabulary
  and TF-IDF ranking. Scores are ranking aids, not probabilities or guarantees.
- Session requests use mentor-published one-hour openings, and pending or
  accepted requests block overlapping times. The backend does not send calendar
  invites or reminders.
- Resume upload extracts text from PDF and DOCX files up to 10 MB. Image-only
  PDFs need OCR, which is not included.
- Local API proxying is configured. A separately hosted frontend needs an API
  URL, HTTPS, and backend CORS configuration; those deployment settings are not
  included here.

See [`../backend/backend.md`](../backend/backend.md) for backend routes, database
setup, PostgreSQL inspection, and backend limitations.
