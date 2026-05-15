# Krewby — Hardcoded Data Handoff

This document lists every value that is currently hardcoded (mock/fake) in the frontend,
what API endpoint should replace it, and what the frontend expects back.

---

## Quick Summary

| # | What's hardcoded | File | Replace with |
|---|---|---|---|
| 1 | Login / auth | `Login.jsx` | `POST /api/auth/login` |
| 2 | Logged-in user identity | `mockData.js → ROLES` | `GET /api/auth/me` |
| 3 | Staff list | `mockData.js → STAFF` | `GET /api/staff` |
| 4 | Dashboard stats (shifts, headcount, pending, unfilled) | `Dashboard.jsx` | `GET /api/dashboard/summary` |
| 5 | Today's shifts (dashboard) | `Dashboard.jsx` | `GET /api/shifts/today` |
| 6 | Pending requests (dashboard) | `Dashboard.jsx` | `GET /api/requests?status=pending` |
| 7 | Workload balance bars | `mockData.js → WORKLOAD` | `GET /api/reports/workload` |
| 8 | Notifications | `Dashboard.jsx` | `GET /api/notifications` |
| 9 | Week schedule grid | `mockData.js → SCHEDULE_ROWS` | `GET /api/schedule` |
| 10 | Smart Assign recommendations | `mockData.js → RECOMMENDATIONS` | `GET /api/schedule/recommend` |
| 11 | Assign staff action | `SmartAssign.jsx` | `PATCH /api/schedule/assign` |
| 12 | Approval queue | `mockData.js → APPROVAL_ITEMS` | `GET /api/requests` |
| 13 | Approve / Deny action | `ApprovalQueue.jsx` | `PATCH /api/requests/:id` |
| 14 | Krewby active requests | `KrewbyRequests.jsx` | `GET /api/krewby/requests` |
| 15 | Submit Krewby request | `KrewbyRequests.jsx` | `POST /api/krewby/requests` |
| 16 | AI Assistant chat | `AIAssistant.jsx` | proxy through `POST /api/ai/chat` |
| 17 | Reports KPIs | `Reports.jsx` | `GET /api/reports/summary` |
| 18 | Attendance today | `Reports.jsx` | `GET /api/attendance/today` |
| 19 | Krewby usage stats | `Reports.jsx` | `GET /api/krewby/stats` |
| 20 | My upcoming shifts (staff) | `MySchedule.jsx` | `GET /api/shifts/mine` |
| 21 | My requests (staff) | `MySchedule.jsx` | `GET /api/requests/mine` |
| 22 | Submit leave / off-day | `MySchedule.jsx` | `POST /api/requests` |
| 23 | Submit shift swap | `MySchedule.jsx` | `POST /api/requests` |
| 24 | Availability grid (load) | `mockData.js → AVAIL_INIT` | `GET /api/availability` |
| 25 | Availability grid (save) | `Availability.jsx` | `PUT /api/availability` |

---

## Detail by Screen

---

### 1. Login — `src/screens/Login.jsx`

**What's hardcoded:**
- Auth always succeeds after a 700ms fake delay
- No token is stored, no session is created

**Replace with:**
```
POST /api/auth/login
Body: { email, password }
Returns: { token, user: { id, name, initials, role, outletId } }
```
Store the token in `localStorage` or a cookie. Pass it as `Authorization: Bearer <token>` on all subsequent requests.

---

### 2. Logged-in user — `src/data/mockData.js → ROLES`

**What's hardcoded:**
- Three fake users (Rachel Lim / David Tan / K. Coordinator) are statically mapped to each role tab
- The role-switcher tabs are a wireframe-only shortcut — in production there is only one logged-in user

**Replace with:**
```
GET /api/auth/me
Returns: { id, name, initials, role: 'manager'|'staff'|'coordinator', outletId }
```
Use the returned `role` to determine which sidebar nav to show. Remove the role-switcher tabs (or keep them for internal demo/testing only).

---

### 3. Staff list — `src/data/mockData.js → STAFF`

**What's hardcoded:** 6 fake staff members with fixed names, skills, hours, status.

**Replace with:**
```
GET /api/staff?outletId=<id>
Returns: [
  {
    id: string,           // e.g. "usr_123"
    name: string,         // "Rachel Lim"
    initials: string,     // "RL"  (or derive on frontend: first letter of each word)
    role: string,         // "Regular Staff · Full-time"
    skills: string[],     // ["Cashier", "Floor Service"]
    hoursThisWeek: number,// 38
    status: string,       // "active" | "leave" | "inactive"
    leaveUntil: string|null  // "2025-06-22" if on leave
  }
]
```

The `color` field (`ma-blue`, `ma-green` etc.) is a CSS class the frontend uses for avatar colors. You can either assign a color index per user server-side, or the frontend can derive it from `id` using a simple modulo.

---

### 4. Dashboard summary stats — `src/screens/Dashboard.jsx`

**What's hardcoded** (inline in JSX):
- Today's shifts: **3**, All filled
- Staff on duty: **12** of **15** scheduled
- Pending requests: **4**
- Unfilled roles: **2**, Conflicts

**Replace with:**
```
GET /api/dashboard/summary?outletId=<id>&date=<today>
Returns: {
  shiftsToday: number,
  shiftsAllFilled: boolean,
  staffOnDuty: number,
  staffScheduled: number,
  pendingRequests: number,
  unfilledRoles: number,
  conflictsFound: number
}
```

---

### 5. Today's shifts (dashboard card) — `src/screens/Dashboard.jsx`

**What's hardcoded:** Morning/Afternoon/Evening shift rows with fixed staff initials and times.

**Replace with:**
```
GET /api/shifts/today?outletId=<id>
Returns: [
  {
    period: 'Morning'|'Afternoon'|'Evening',
    timeRange: '07:00–15:00',
    roles: string,        // "Cashier · Floor"
    assigned: [{ id, initials, colorClass }],
    unfilledCount: number
  }
]
```

---

### 6. Pending requests (dashboard card) — `src/screens/Dashboard.jsx`

**What's hardcoded:** 3 inline request items (swap, leave, replacement).

**Replace with:**
```
GET /api/requests?status=pending&outletId=<id>&limit=5
Returns: [
  {
    id: string,
    type: 'swap'|'leave'|'replacement',
    title: string,
    detail: string,
    urgency: 'normal'|'urgent'
  }
]
```
The frontend maps `type` → icon and badge color automatically.

---

### 7. Workload balance bars — `src/data/mockData.js → WORKLOAD`

**What's hardcoded:** 5 staff with fixed hours and percentages.

**Replace with:**
```
GET /api/reports/workload?outletId=<id>&week=<weekNumber>
Returns: [
  {
    staffId: string,
    initials: string,
    colorClass: string,
    hoursLabel: string,   // "32h"
    pct: number,          // 0–100 relative to team average
    warn: boolean         // true when below threshold
  }
]
```

---

### 8. Notifications — `src/screens/Dashboard.jsx`

**What's hardcoded:** 2 inline notification items.

**Replace with:**
```
GET /api/notifications?outletId=<id>&unread=true
Returns: [
  {
    id: string,
    type: 'success'|'warning'|'error'|'info',
    title: string,
    subtitle: string,
    timeAgo: string,      // "2h ago"
    read: boolean
  }
]
```

---

### 9. Week schedule grid — `src/data/mockData.js → SCHEDULE_ROWS / WEEK_DAYS`

**What's hardcoded:** Full week 25 grid with staff initials and unfilled blocks for every day × period.

**Replace with:**
```
GET /api/schedule?outletId=<id>&week=<number>&year=<year>
Returns: {
  weekLabel: 'Week 25 · 10–16 Jun 2025',
  days: ['Mon 10', 'Tue 11', ...],
  rows: [
    {
      period: 'Morning',
      cells: [
        // one per day
        {
          staff: ['RL','DT','SN'],
          overflow: 2,           // additional staff beyond display limit
          unfilledCount: 0
        },
        ...
      ]
    },
    ...
  ],
  conflictsCount: 3,
  published: false
}
```

---

### 10. Smart Assign recommendations — `src/data/mockData.js → RECOMMENDATIONS`

**What's hardcoded:** 3 ranked staff with fixed scores and rationale text.

**Replace with:**
```
GET /api/schedule/recommend?shiftId=<id>&role=<roleName>
Returns: [
  {
    rank: number,
    staffId: string,
    name: string,
    skills: string[],
    reason: string,         // AI-generated rationale text
    scores: {
      avail: number,        // 0–100
      skill: number,
      rest: number,
      load: number
    },
    top: boolean
  }
]
```

---

### 11. Assign staff action — `src/screens/SmartAssign.jsx`

**What's hardcoded:** Clicking "Assign" only shows a local success message — nothing is persisted.

**Replace with:**
```
PATCH /api/schedule/assign
Body: { shiftId, slotRole, staffId }
Returns: { success: boolean, updatedShift: { ... } }
```

---

### 12 & 13. Approval queue — `src/data/mockData.js → APPROVAL_ITEMS` + `ApprovalQueue.jsx`

**What's hardcoded:** 4 requests; Approve/Deny only updates local React state.

**Replace with:**
```
GET  /api/requests?outletId=<id>&status=pending
PATCH /api/requests/:id
Body: { status: 'approved' | 'denied', note?: string }
Returns: { id, status, updatedAt }
```

---

### 14. Krewby active requests — `src/screens/KrewbyRequests.jsx`

**What's hardcoded:** 2 inline request cards (1 AI-matched, 1 confirmed).

**Replace with:**
```
GET /api/krewby/requests?outletId=<id>
Returns: [
  {
    id: string,
    skill: string,
    headcount: number,
    date: string,
    timeRange: string,
    status: 'pending'|'ai_matched'|'confirmed'|'completed',
    aiMatch?: { name, rating, distance, skills }
  }
]
```

---

### 15. Submit Krewby request — `src/screens/KrewbyRequests.jsx`

**What's hardcoded:** Form submission only shows a success state — nothing is sent.

**Replace with:**
```
POST /api/krewby/requests
Body: { outletId, skill, date, startTime, endTime, headcount, address }
Returns: { id, status: 'pending', estimatedMatchTime: '2h' }
```

---

### 16. AI Assistant — `src/screens/AIAssistant.jsx`

**What's hardcoded:** The Claude API is called directly from the browser using a raw `fetch` to `api.anthropic.com`.

⚠️ **This must change before production** — the API key would be exposed in the browser.

**Replace with:**
```
POST /api/ai/chat
Body: { messages: [{ role, content }] }
Returns: { reply: string }
```
The backend holds the Anthropic API key, applies rate limiting, and injects a system prompt with real outlet/schedule context pulled from the database.

---

### 17. Reports KPIs — `src/screens/Reports.jsx`

**What's hardcoded:** Avg hours 35.8h, fill rate 94%, 7 Krewby workers used.

**Replace with:**
```
GET /api/reports/summary?outletId=<id>&month=<YYYY-MM>
Returns: {
  avgHoursPerStaff: number,
  shiftFillRate: number,      // 0–100
  krewbyWorkersUsed: number
}
```

---

### 18. Attendance today — `src/screens/Reports.jsx`

**What's hardcoded:** 4 staff with fixed clock-in times and statuses.

**Replace with:**
```
GET /api/attendance/today?outletId=<id>
Returns: [
  {
    staffId: string,
    name: string,
    initials: string,
    colorClass: string,
    clockIn: string|null,     // "06:58" or null if absent
    status: 'on_time'|'late'|'absent'
  }
]
```

---

### 19. Krewby usage stats — `src/screens/Reports.jsx`

**What's hardcoded:** Total requests 9, confirmed 7, cancellations 1, no-shows 1, avg rating 4.6.

**Replace with:**
```
GET /api/krewby/stats?outletId=<id>&month=<YYYY-MM>
Returns: {
  totalRequests: number,
  confirmedWorkers: number,
  cancellations: number,
  noShows: number,
  avgWorkerRating: number
}
```

---

### 20. My upcoming shifts (staff) — `src/screens/MySchedule.jsx`

**What's hardcoded:** 3 inline shifts with fixed dates and acknowledgment statuses.

**Replace with:**
```
GET /api/shifts/mine?staffId=<id>&from=<date>
Returns: [
  {
    id: string,
    date: string,
    period: string,
    timeRange: string,
    role: string,
    ackStatus: 'acknowledged'|'pending'
  }
]
```

---

### 21. My requests (staff) — `src/screens/MySchedule.jsx`

**What's hardcoded:** 1 inline pending leave request.

**Replace with:**
```
GET /api/requests/mine?staffId=<id>
Returns: [
  {
    id: string,
    type: 'leave'|'swap'|'replacement',
    description: string,
    status: 'pending'|'approved'|'denied'
  }
]
```

---

### 22 & 23. Submit leave / swap (staff) — `src/screens/MySchedule.jsx`

**What's hardcoded:** Forms don't submit anywhere.

**Replace with:**
```
POST /api/requests
Body (leave):  { staffId, type: 'leave', leaveType, fromDate, toDate }
Body (swap):   { staffId, type: 'swap', myShiftId, swapWithStaffId }
Returns: { id, status: 'pending' }
```

---

### 24 & 25. Availability grid — `src/data/mockData.js → AVAIL_INIT` + `Availability.jsx`

**What's hardcoded:** Grid pre-filled with fixed yes/maybe/no values. Submitting doesn't save anything.

**Replace with:**
```
GET /api/availability?staffId=<id>&week=<weekNumber>
Returns: {
  week: number,
  slots: [
    { period: 'Morning',   day: 'Mon', value: 'yes'|'maybe'|'no' },
    ...  (21 slots total: 3 periods × 7 days)
  ]
}

PUT /api/availability
Body: { staffId, week, slots: [{ period, day, value }] }
Returns: { success: boolean }
```

---

## What is NOT hardcoded (no backend needed)

| Item | Reason |
|---|---|
| Sidebar navigation items | Static UI config — visibility controlled by user role from auth |
| CSS styles / design tokens | Pure frontend |
| Screen routing logic | Pure frontend state |
| Badge colors, icons per request type | Frontend mapping logic |
| Availability grid toggle behavior | Local UI interaction |
| Week days / period labels | Static UI labels |
