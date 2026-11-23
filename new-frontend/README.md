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

Open <http://localhost:5173>. Vite proxies `/auth`, `/users`, and `/health` to
FastAPI at `http://localhost:8000`. Keep `VITE_API_BASE_URL` empty for local
development. The backend has no `/api` route prefix. Restart Vite after changing
`.env` because Vite reads it at startup.

## Sign in and use the dashboard

The sign-in screen lets you select a seeded demo account or register a new
account. Seeded demo accounts use the local-only password
`MentorMatchDemo2026!`. After sign-in, the dashboard stays on that account;
signing out returns to the login screen.

The dashboard supports profile editing, PDF/DOCX resume upload, live mentor
recommendations, goal progress history, session requests and responses, session
notifications, and password changes. A graduate can request a session from a
mentor card or from the Sessions page. Mentors can accept or decline requests.

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
- Session requests save a suggested date and time, but the backend does not
  check mentor availability or overlapping appointments and does not send
  calendar invites or reminders.
- Resume upload extracts text from PDF and DOCX files up to 10 MB. Image-only
  PDFs need OCR, which is not included.
- Local API proxying is configured. A separately hosted frontend needs an API
  URL, HTTPS, and backend CORS configuration; those deployment settings are not
  included here.

See [`../backend/backend.md`](../backend/backend.md) for backend routes, database
setup, PostgreSQL inspection, and backend limitations.
