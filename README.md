# FYP-26-S2-9

# Krewby

Krewby is a workforce scheduling and task allocation platform for
Business → Branch → Shift → Task structures, built for CSIT-26-S2-04
("Smart Task Allocation Application").

---

# Features

- Five roles with role-scoped dashboards: `system_admin`, `business_owner`,
  `branch_manager`, `regular_staff`, `casual_staff`
- Automatic shift generation from per-weekday task templates, with manual
  creation for exceptions (closures, one-off cover shifts)
- Branch closures and public holidays (with a `treat_public_holidays_as_working`
  toggle), operating-hours and labour-rule configuration
- Deterministic + AI-assisted casual worker auto-assignment, with a
  configurable weighting model (availability, skills, attendance, performance,
  workload)
- Timesheets with actual worked/additional/overtime hours, branch manager
  approve/reject, and a working-hours report
- Leave, off-day, and swap requests with approval workflows
- Role-aware in-app notifications plus web push (VAPID) and Expo push
- Installable PWA with offline-friendly service worker and safe-area support
  for mobile browsers
- Supabase authentication; PostgreSQL via Supabase, accessed through Prisma

---

# Tech Stack

Frontend:
- React
- Vite
- React Router DOM
- Deployed on Vercel; installable as a PWA

Backend:
- Node.js
- Express.js
- Prisma ORM
- Deployed on Render

Database & Authentication:
- Supabase PostgreSQL
- Supabase Authentication

---

# Getting Started

## 1. Install Requirements

Install:
- Node.js
- npm
- VS Code

---

# Backend Setup

## Go into backend folder

```bash
cd backend
```

## Install dependencies

```bash
npm install
```

## Create `.env`

Inside `backend/.env`

```env
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_database_url
JWT_SECRET=your_secret_key
PORT=3001
```

(`PORT` falls back to 5000 in code if unset, but this project runs on
3001 — keep it set to 3001, since that's what the frontend's
`VITE_API_URL` below expects for local development. The deployed
backend runs on Render.)

Optional, only needed once you're not just running everything on
localhost:

```env
FRONTEND_URL=https://your-deployed-frontend.vercel.app
PUBLIC_APP_URL=https://your-deployed-frontend.vercel.app
```

These look like the same thing and are not — `FRONTEND_URL` is a
**comma-separated CORS allowlist** (`app.js` splits it on `,`; add
your production domain plus any specific preview URLs here), while
`PUBLIC_APP_URL` is the **single origin** used to build links that get
emailed to users (invitations, password reset). Putting a
comma-separated value in `PUBLIC_APP_URL`, or expecting `FRONTEND_URL`
alone to work for both, is exactly the bug this split exists to
prevent. Both fall back to `http://localhost:5173` if unset, which is
correct for local dev but wrong in production — `PUBLIC_APP_URL`
missing in production logs a startup warning rather than failing
silently.

## Run Prisma

```bash
npx prisma generate
```

## Start backend server

```bash
npm run dev
```

Backend runs on:

```txt
http://localhost:3001
```

---

# Frontend Setup

## Go into frontend folder

```bash
cd frontend
```

## Install dependencies

```bash
npm install
```

## Create `.env`

Inside `frontend/.env`

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

(`VITE_API_URL` is where the frontend sends its API calls — point it
at the backend port above. Web push notifications also need
`VITE_VAPID_PUBLIC_KEY`, matching `VAPID_PUBLIC_KEY` in the backend's
`.env`; see `backend/src/utils/pushNotify.js`.)

## Start frontend

```bash
npm run dev
```

Frontend runs on:

```txt
http://localhost:5173
```

---

# Supabase Setup

## Create Supabase Project

Go to:

```txt
https://supabase.com
```

---

## Get API Keys

Supabase Dashboard:

```txt
Settings → API
```

Copy:
- Project URL
- anon public key

---

## Create Users

Go to:

```txt
Authentication → Users
```

Create users manually.

Then add matching records into:

```txt
public.users
```

---

# Available Roles

```txt
system_admin
business_owner
branch_manager
regular_staff
casual_staff
```

`business_owner` owns one or more businesses, each with one or more
branches. `branch_manager` is scoped to a single branch. `regular_staff`
belong to a branch; `casual_staff` belong to a business and express
branch preferences rather than being fixed to one branch.

---

# Run Project

Open TWO terminals.

## Terminal 1

```bash
cd backend
npm run dev
```

## Terminal 2

```bash
cd frontend
npm run dev
```

---

# Git Commands

## Check status

```bash
git status
```

## Add files

```bash
git add .
```

## Commit changes

```bash
git commit -m "your message"
```

## Push to GitHub

```bash
git push origin main
```

---

# Mobile

`mobile/` is a React Native (Expo) prototype — exploratory, not the
delivered product. It is not deployed and isn't part of the
submission's mobile story. Mobile access to Krewby is via the web
app's installable PWA (see `frontend/public/manifest.json` and
`frontend/public/sw.js`), which runs the same app as desktop.
