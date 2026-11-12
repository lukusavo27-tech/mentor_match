# MentorMatch Frontend

React + Vite + Tailwind CSS v4 starter UI for the MentorMatch graduate-to-mentor matching system.

## Requirements
- Node.js 20+ recommended
- npm

## Setup
```bash
npm install
cp .env.example .env
npm run dev
```
Open http://localhost:5173.

## Build
```bash
npm run build
npm run preview
```

## Current screens
- Graduate dashboard overview
- Mentor dashboard preview (use the role switcher)
- Mentor recommendations with sample compatibility scores
- Profile form mock-up
- Sessions empty state
- Settings placeholder

## Important implementation notes
- The dashboard currently uses demo data from `src/data/demo.js`.
- Buttons that describe future API actions show an explanatory notice; they do not persist data yet.
- The sample compatibility percentages are visual placeholders, NOT NLP results.
- API client configuration is in `src/services/api.js`.
- Set `VITE_API_BASE_URL` in `.env` to the backend API base URL.

## Suggested next steps
1. Add landing and authentication pages.
2. Implement real profile forms and role-specific navigation.
3. Connect authentication and profile APIs.
4. Implement resume upload and real NLP-based recommendations.
5. Add mentor availability and session-request flows.
