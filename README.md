# FYP-26-S2-9

# Krewby

Krewby is a Smart Workforce Management System for managing:

- Staff
- Shift scheduling
- Attendance
- Availability
- Workforce requests

---

# Features

- Role-based login
- Different dashboards for different actors
- Shift management
- Availability management
- Attendance management
- Supabase authentication
- PostgreSQL database with Prisma

---

# Tech Stack

Frontend:
- React
- Vite
- React Router DOM

Backend:
- Node.js
- Express.js
- Prisma ORM

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
```

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
http://localhost:5000
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
```

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
outlet_manager
regular_staff
outlet_casual_staff
krewby_coordinator
krewby_casual_worker
```

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

# To-Do

- Improve dashboard UI
- Add shift assignment system
- Add attendance tracking
- Add notifications
- Add reporting system