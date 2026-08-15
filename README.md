# FYP-26-S2-9 — Krewby

Krewby is a workforce scheduling and task allocation platform for
Business → Branch → Shift → Task structures, built for CSIT-26-S2-04
("Smart Task Allocation Application").

A business owner runs one or more branches; each branch runs its own
shifts, built from task templates, staffed by a mix of regular staff
(populated onto their contracted days) and casual staff (allocated by
a configurable, weighted matching model). Branch managers run day-to-day
scheduling; a system admin oversees the platform.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone and install](#1-clone-and-install)
  - [2. Supabase project](#2-supabase-project)
  - [3. Environment variables](#3-environment-variables)
  - [4. Database setup](#4-database-setup)
  - [5. Run the app](#5-run-the-app)
- [Running Tests](#running-tests)
- [Roles](#roles)
- [Deployment](#deployment)
- [Mobile](#mobile)
- [Git Workflow](#git-workflow)
- [Further Documentation](#further-documentation)

---

## Features

- **Five roles with role-scoped dashboards**: `system_admin`,
  `business_owner`, `manager` (branch manager), `regular_staff`,
  `casual_staff` — see [Roles](#roles) for what each can do.
- **Automatic shift generation** from per-weekday, per-branch task
  templates, with manual creation for exceptions (closures, one-off cover
  shifts). Generation is idempotent — re-running it skips dates/periods
  that already have a shift rather than duplicating them.
- **Branch shift periods** (e.g. Morning/Evening crews), branch closures,
  and a public-holidays reference table with a per-branch
  `treat_public_holidays_as_working` toggle.
- **Deterministic + AI-assisted casual worker allocation**, with a
  configurable weighting model (skills match, attendance, workload) that
  business owners tune per branch, plus AI-generated shift recommendations
  and an in-app assistant (OpenAI; an optional Azure AI Foundry knowledge
  base can back the assistant's Q&A if configured — see
  [Environment Variables](#3-environment-variables)).
- **Timesheets** with actual worked / additional / overtime hours, manager
  approve/reject, and a working-hours report.
- **Leave, off-day, and swap requests** with approval workflows.
- **Casual worker self-onboarding**: a business-wide join code for casual
  workers to apply, reviewed/approved from the business owner's Casual Pool
  page — separate from the per-person invitation-code flow used for
  regular staff and managers.
- **Role-aware in-app notifications**, plus web push (VAPID) and Expo push
  for the mobile prototype.
- **Installable PWA** — meets all installability requirements (manifest,
  icons, registered service worker) and has safe-area support for mobile
  browsers. The service worker currently handles web push delivery only;
  it does not cache assets or provide offline support. This installable
  web app *is* the project's mobile deliverable — see [Mobile](#mobile).
- **Supabase authentication**; PostgreSQL via Supabase, accessed through
  Prisma, with a tracked migration history (`backend/prisma/migrations/`).

---

## Tech Stack

**Frontend**
- React + Vite, React Router DOM
- Deployed on Vercel; installable as a PWA
- Jest for unit tests (session/auth-storage logic)

**Backend**
- Node.js + Express.js
- Prisma ORM, with PostgREST access via the Supabase client for a few
  tables (a mix used deliberately, not interchangeably — see comments in
  `backend/src/config/`)
- Deployed on Render
- Jest for unit/integration tests (controllers, utils, migration coverage)

**Database & Auth**
- Supabase PostgreSQL, schema managed through Prisma migrations
- Supabase Authentication (email/password; password-reset flow uses
  Supabase's own recovery-link mechanism)

**AI**
- OpenAI (`gpt-4o-mini`) for shift recommendations and the AI assistant
- Optional: Azure AI Foundry knowledge-base lookup backing the assistant

**Mobile**
- React Native (Expo) — see [Mobile](#mobile)

---

## Project Structure

```txt
FYP-26-S2-9/
├── backend/
│   ├── src/
│   │   ├── controllers/    # one file per resource area (shifts, staff, casual, invitations, ...)
│   │   ├── routes/         # Express route definitions, mapped to controllers
│   │   ├── services/       # AI assistant + recommendation logic, shared cross-controller helpers
│   │   ├── utils/          # pure, dependency-free helpers (unit tested directly)
│   │   ├── middleware/     # auth (verifyToken/allowRoles), error handling
│   │   ├── jobs/           # scheduled cron jobs (rolling shift generation, notifications)
│   │   └── config/         # Prisma client, Supabase clients, logger
│   ├── prisma/
│   │   ├── schema.prisma   # data model
│   │   ├── migrations/     # tracked, ordered schema history — see Database Setup
│   │   └── seed/           # optional seed/backfill scripts, applied separately from migrations
│   └── tests/              # Jest suites, one per controller/util/behaviour
├── frontend/
│   └── src/
│       ├── pages/           # one subfolder per role (business-owner/, manager/, regular-staff/, casual-staff/, system-admin/)
│       ├── components/      # shared UI + per-role layouts
│       ├── lib/             # API client, Supabase client
│       └── utils/           # session/auth-storage helpers
├── mobile/                 # Expo prototype — see Mobile
├── docs/                   # supplementary docs (e.g. retest guides)
└── CHANGELOG.md            # dated, narrative log of what changed and why
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and npm
- A [Supabase](https://supabase.com) project (free tier is enough for
  development)
- A code editor (VS Code recommended)

### Hardware and software requirements

**To run the app locally / develop:**
- Node.js 20 (pinned in `.github/workflows/ci.yml`; a recent LTS should
  also work) and npm
- Any OS that runs Node 20 (Windows, macOS, Linux)
- No specific hardware minimums — a standard development machine capable
  of running Node, a browser, and (optionally) a local Postgres instance
  is sufficient

**To use the deployed app as an end user:**
- A modern, evergreen browser with Service Worker support (e.g. Chrome,
  Edge, Firefox, Safari) — required for the installable PWA
- Internet access; no specific device hardware requirements beyond what
  the browser itself needs

---

## Getting Started

### 1. Clone and install

```bash
git clone <this-repo-url>
cd FYP-26-S2-9

cd backend && npm install
cd ../frontend && npm install
```

(`mobile/` has its own `npm install` — see [Mobile](#mobile) — skip it
unless you're specifically working on the mobile prototype.)

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → API** — copy the Project URL, the `anon` public key, and
   the `service_role` key.
3. **Authentication → Users** — you can create your first user here
   manually; the app's own registration flows (`/register`,
   `/register-business`, invitation/join-code acceptance) create both the
   Supabase Auth user and the matching `public.users` row together, so
   manual user creation is only needed for a first admin account.

### 3. Environment variables

**`backend/.env`** — required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase's pooled (PgBouncer) connection string — used by the running app |
| `DIRECT_URL` | Supabase's direct (non-pooled) connection string — used by Prisma migrations |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | `service_role` key — server-side admin access |
| `SUPABASE_ANON_KEY` | `anon` key — used for the backend's own Supabase Auth client |
| `JWT_SECRET` | Signs the app's own session tokens |
| `PORT` | Defaults to 3001 in this project's scripts; keep it matched with the frontend's `VITE_API_URL` |

Optional — features degrade gracefully (skip/log a warning) if these are
unset, rather than failing outright:

| Variable | Purpose |
|---|---|
| `FRONTEND_URL` | **Comma-separated** CORS allowlist (production domain + any preview URLs) |
| `PUBLIC_APP_URL` | **Single origin** used to build links emailed to users (invitations, password reset). Not interchangeable with `FRONTEND_URL` — see the inline comment in `backend/src/config/publicAppUrl.js`. Logs a startup warning if unset in production. |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | Outbound email (invitations, password reset) via the Gmail API over HTTPS — deliberately not SMTP, since Render blocks outbound SMTP ports |
| `OPENAI_API_KEY` | Shift recommendations + AI assistant |
| `AZURE_FOUNDRY_KEY` / `AZURE_FOUNDRY_ENDPOINT` | Optional knowledge-base backing for the AI assistant |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push notifications |
| `LOG_LEVEL` | Pino log level (defaults to `info`) |
| `NODE_ENV` | `production` enables production-mode logging/error responses |

**`frontend/.env`**:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` key |
| `VITE_API_URL` | Where the frontend sends API calls — `http://localhost:3001` locally |
| `VITE_VAPID_PUBLIC_KEY` | Optional — must match the backend's `VAPID_PUBLIC_KEY` for web push |

### 4. Database setup

Generate the Prisma client, then apply the tracked migration history:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` builds the full schema from scratch on an empty database.
If you're pointing at a Supabase project that already has this schema
(e.g. one shared with a teammate), mark the migrations as already applied
instead of re-running them:

```bash
npx prisma migrate resolve --applied <migration_name>
```

Optional seed/backfill data lives in `backend/prisma/seed/` (industry
skill-tag catalog, public holidays, etc.) — apply the `.sql` files you
want directly against your database; they're kept separate from the
schema migrations deliberately, so a schema change and its data backfill
can be reviewed independently.

### 5. Run the app

Two terminals:

```bash
# Terminal 1
cd backend
npm run dev
```

```bash
# Terminal 2
cd frontend
npm run dev
```

| | URL |
|---|---|
| Backend | http://localhost:3001 |
| Frontend | http://localhost:5173 |

---

## Running Tests

```bash
cd backend && npm test            # Jest — controllers, utils, migration coverage
cd backend && npm run test:coverage

cd frontend && npm test           # Jest — session/auth-storage logic
```

Backend tests mock Prisma/Supabase (no live database needed to run them).
Frontend tests run under jsdom and cover `utils/auth.js` and the
`api.js` request layer — not full component rendering.

---

## Roles

```txt
system_admin
business_owner
manager          # "Branch Manager" in the UI; the role value in the
                 # database and JWTs is the shorter "manager"
regular_staff
casual_staff
```

- `business_owner` owns one or more businesses, each with one or more
  branches.
- `manager` is scoped to a single branch (day-to-day scheduling,
  approvals, casual auto-assignment for that branch).
- `regular_staff` belong to a single branch and are placed onto their
  contracted days by shift generation.
- `casual_staff` belong to a business and express branch preferences
  rather than being fixed to one branch; they're allocated to open tasks
  rather than auto-populated onto a schedule.
- `system_admin` oversees the platform (not scoped to one business).

---

## Deployment

- **Backend** — Render. Set the backend environment variables above in
  Render's dashboard; `PUBLIC_APP_URL` in particular has no working
  default in production and must be set explicitly, or emailed links
  fall back to `localhost`.
- **Frontend** — Vercel. `frontend/vercel.json` has the SPA rewrite
  needed for client-side routes (e.g. `/invite/:token`) to resolve
  correctly on a hard refresh/direct link.
- **Database** — Supabase. Password-reset links additionally require the
  Supabase project's own **Authentication → URL Configuration** (Site
  URL / Redirect URLs) to include the deployed frontend's domain — this
  is separate from anything in this repo's code or env vars.

---

## Mobile

```bash
cd mobile
npm install
```

`mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=http://localhost:3001
```

```bash
npm start        # Expo dev server
npm run android   # or: npm run ios
```

`mobile/` is a React Native (Expo) prototype — exploratory, not the
delivered product. It is not deployed and isn't part of the submission's
mobile story. Mobile access to Krewby is via the web app's installable
PWA (see `frontend/public/manifest.json` and `frontend/public/sw.js`),
which runs the same app as desktop.

---

## Git Workflow

```bash
git status                      # what's changed
git add <files>                 # stage specific files (avoid `git add .` blindly)
git commit -m "your message"
git push origin <branch>
```

Work on a feature branch and open a PR against `main` rather than pushing
directly, except for small, already-verified fixes.

---

## Further Documentation

- `CHANGELOG.md` — dated, narrative log of what changed and why, at the
  level of individual fixes/features rather than commit messages.
- `docs/` — supplementary documents, e.g. `RETEST_AFTER_ROUND7.md`, a
  targeted list of which system-test cases a given round of fixes should
  flip or put at re-confirmation risk.
