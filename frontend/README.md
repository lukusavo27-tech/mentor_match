# MentorMatch frontend

React, Vite and Tailwind CSS frontend for the MentorMatch mentoring platform.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Run `npm run build` to create a production build.

## Page modules and routes

Each screen is a separate component in `src/pages` and is registered in `src/App.jsx`.

| Page | Route |
| --- | --- |
| Landing | `/` |
| Login | `/login` |
| Registration | `/register` |
| Mentee dashboard | `/mentee/dashboard` |
| Mentee profile | `/mentee/profile` |
| Resume upload | `/mentee/resume` |
| Mentor recommendations | `/mentee/recommendations` |
| Mentor profile details | `/mentee/mentors/:mentorId` |
| Session scheduling | `/mentee/schedule/:mentorId?` |
| Mentee goals | `/mentee/goals` |
| Mentee account settings | `/mentee/settings` |
| Mentor dashboard | `/mentor/dashboard` |
| Mentor profile | `/mentor/profile` |
| Mentor availability | `/mentor/availability` |
| Mentor goals | `/mentor/goals` |
| Mentor account settings | `/mentor/settings` |
| Administrator dashboard | `/admin/dashboard` |
| User management | `/admin/users` |
| Activity monitoring | `/admin/activity` |

## Shared components

Reusable navigation and layout live in `src/components`: `NavigationBar`, `Sidebar`, `UserAvatar`, `Topbar`, `FormField`, `FileUploader`, `Calendar`, `TimeSlotSelector`, `MentorCard`, `CompatibilityIndicator`, `ConfirmationModal`, feedback components (`NotificationArea`, `LoadingIndicator`, `ErrorMessage`, `SuccessMessage`), and shared profile, stat and goal cards.

## Demo accounts

Use the account selector on `/login` to populate the credentials, or use any of these seeded users:

| Role | Email | Password |
| --- | --- | --- |
| Mentee | `tillen@example.com` | `Mentor123!` |
| Mentee | `wanjiru@example.com` | `Mentor123!` |
| Mentee | `brian@example.com` | `Mentor123!` |
| Mentor | `grace@example.com` | `Mentor123!` |
| Mentor | `david@example.com` | `Mentor123!` |
| Mentor | `amina@example.com` | `Mentor123!` |
| Administrator | `admin@example.com` | `Mentor123!` |

These are frontend preview accounts only. Do not reuse these credentials or treat them as secured authentication.

## Backend integration boundary

- `src/services/api.js` provides the Axios client. Set `VITE_API_BASE_URL` to the backend API base URL.
- Screens currently use demo data and browser local storage so their interactions can be reviewed before the API is connected.
- The backend must allow the frontend origin through CORS. Reads will use `GET`; registration, profile/resume submissions, availability edits and session requests also require appropriate write methods such as `POST`, `PUT` or `DELETE`.
- Compatibility scores and activity records shown in demo mode are not backend or NLP results. The frontend should render the matching API response when that integration is implemented.
- Authentication, cross-user goal sharing, authoritative availability checks, persistent uploads and admin account actions require backend support.
