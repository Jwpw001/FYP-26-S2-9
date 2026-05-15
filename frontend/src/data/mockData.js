// ─────────────────────────────────────────────────────────────────────────────
// mockData.js — ALL VALUES IN THIS FILE ARE HARDCODED / MOCK DATA
//
// Every export here must eventually be replaced by a real API call.
// Each section is tagged with the API endpoint the backend should provide.
// The shape of each object is what the frontend expects — keep field names
// consistent when wiring up real data.
// ─────────────────────────────────────────────────────────────────────────────


// ─── [HARDCODED] STAFF LIST ───────────────────────────────────────────────────
// Replace with: GET /api/staff
// Returns: array of staff objects for the logged-in outlet
export const STAFF = [
  {
    id: 'RL',                                        // [HARDCODED] user ID / initials
    name: 'Rachel Lim',                              // [HARDCODED] full name
    role: 'Regular Staff · Full-time',               // [HARDCODED] employment type label
    skills: ['Cashier', 'Floor Service', 'Barista'], // [HARDCODED] skill tags
    hours: '38h / week',                             // [HARDCODED] display string
    hoursNum: 38,                                    // [HARDCODED] numeric hours this week
    status: 'active',                                // [HARDCODED] 'active' | 'leave' | 'inactive'
    color: 'ma-blue',                                // [HARDCODED] avatar CSS class — assign server-side or derive from user ID
  },
  {
    id: 'DT',
    name: 'David Tan',
    role: 'Regular Staff · Full-time',
    skills: ['Floor Service', 'Cashier'],
    hours: '32h / week',
    hoursNum: 32,
    status: 'active',
    color: 'ma-green',
  },
  {
    id: 'SN',
    name: 'Sarah Ng',
    role: 'Regular Staff · Full-time',
    skills: ['Barista', 'Kitchen', 'Floor Service'],
    hours: 'On leave 20–22 Jun',                    // [HARDCODED] derive from approved leave records
    hoursNum: 38,
    status: 'leave',
    color: 'ma-purple',
  },
  {
    id: 'MP',
    name: 'Maya Patel',
    role: 'Outlet Casual Staff',
    skills: ['Floor Service', 'Kitchen'],
    hours: '22h / week',
    hoursNum: 22,
    status: 'active',
    color: 'ma-amber',
    warning: true,                                   // [HARDCODED] flag when hours < threshold (backend computes)
  },
  {
    id: 'YK',
    name: 'Yusuf Kim',
    role: 'Regular Staff · Part-time',
    skills: ['Cashier'],
    hours: '40h / week',
    hoursNum: 40,
    status: 'active',
    color: 'ma-purple',
  },
  {
    id: 'AH',
    name: 'Amy Hassan',
    role: 'Outlet Casual Staff',
    skills: ['Floor Service', 'Cashier', 'Barista'],
    hours: '35h / week',
    hoursNum: 35,
    status: 'active',
    color: 'ma-blue',
  },
];


// ─── [HARDCODED] LOGGED-IN USER PROFILES PER ROLE ────────────────────────────
// Replace with: GET /api/auth/me
// In the real app, the logged-in user's name, initials, and role come from
// the auth token / session — not from this static object.
export const ROLES = {
  manager: {
    label: 'Outlet Manager',
    initials: 'RL',             // [HARDCODED] derive from user's name
    name: 'Rachel Lim',         // [HARDCODED] logged-in user's full name
    sub: 'Outlet Manager',      // [HARDCODED] role subtitle
  },
  staff: {
    label: 'Staff',
    initials: 'DT',
    name: 'David Tan',
    sub: 'Outlet Casual Staff',
  },
  coordinator: {
    label: 'Krewby Coordinator',
    initials: 'KC',
    name: 'K. Coordinator',
    sub: 'Krewby Coordinator',
  },
};


// ─── NAVIGATION CONFIG (static UI — not from backend) ────────────────────────
// These are UI-only constants. No API replacement needed.
// Which nav tabs a user sees should be controlled by their permissions from /api/auth/me
export const MANAGER_NAV = [
  { id: 'dashboard',  icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { id: 'schedule',   icon: 'ti-calendar-week',    label: 'Schedule' },
  { id: 'staff',      icon: 'ti-users',             label: 'Staff' },
  { id: 'approval',   icon: 'ti-check-circle',      label: 'Approval Queue' },
  { id: 'krewby',     icon: 'ti-briefcase',         label: 'Krewby Requests' },
  null,
  { id: 'ai',         icon: 'ti-message-bolt',      label: 'AI Assistant' },
  { id: 'reports',    icon: 'ti-chart-bar',         label: 'Reports' },
];

export const STAFF_NAV = [
  { id: 'myshift',      icon: 'ti-calendar-user', label: 'My Schedule' },
  { id: 'availability', icon: 'ti-clock-check',   label: 'My Availability' },
];

export const COORD_NAV = [
  { id: 'krewby',  icon: 'ti-briefcase',    label: 'Krewby Requests' },
  null,
  { id: 'ai',      icon: 'ti-message-bolt', label: 'AI Assistant' },
  { id: 'reports', icon: 'ti-chart-bar',    label: 'Reports' },
];


// ─── SCREEN TITLES (static UI — not from backend) ────────────────────────────
export const SCREEN_TITLES = {
  dashboard:    'Dashboard',
  schedule:     'Shift Schedule',
  recommend:    'Smart Assign — Sun 16 Evening', // [HARDCODED] shift label — make dynamic
  staff:        'Staff Management',
  approval:     'Approval Queue',
  krewby:       'Krewby Requests',
  ai:           'AI Workforce Assistant',
  reports:      'Reports & Attendance',
  myshift:      'My Schedule',
  availability: 'My Availability',
};


// ─── [HARDCODED] WEEK SCHEDULE ────────────────────────────────────────────────
// Replace with: GET /api/schedule?week=25&outlet=<outletId>
// Returns: for each day x period slot → assigned staff initials + unfilled count

export const WEEK_DAYS = [
  'Mon 10', 'Tue 11', 'Wed 12', 'Thu 13', 'Fri 14', 'Sat 15', 'Sun 16',
]; // [HARDCODED] — compute from selected week number + year

export const SCHEDULE_ROWS = [
  {
    label: 'Morning',
    cells: [
      [{ text: 'RL · DT · SN', cls: 'sb-blue' }, { text: '+2 more', cls: 'sb-blue' }],
      [{ text: 'DT · MP · YK', cls: 'sb-blue' }],
      [{ text: 'RL · SN · AH', cls: 'sb-blue' }],
      [{ text: 'MP · YK · DT', cls: 'sb-blue' }],
      [{ text: 'SN · AH · RL', cls: 'sb-blue' }],
      [{ text: 'YK · MP', cls: 'sb-blue' }, { text: '1 unfilled', cls: 'sb-amber' }],
      [{ text: 'DT · SN', cls: 'sb-blue' }],
    ],
  },
  {
    label: 'Afternoon',
    cells: [
      [{ text: 'AH · YK · MP', cls: 'sb-green' }],
      [{ text: 'RL · SN', cls: 'sb-green' }],
      [{ text: 'DT · AH · MP', cls: 'sb-green' }],
      [{ text: 'RL · SN · YK', cls: 'sb-green' }],
      [{ text: 'MP · AH', cls: 'sb-green' }],
      [{ text: 'RL · DT · SN', cls: 'sb-green' }],
      [{ text: '2 unfilled !', cls: 'sb-red' }],
    ],
    cellStyles: [null, null, null, null, null, null, { background: 'rgba(226,75,74,0.05)' }],
  },
  {
    label: 'Evening',
    cells: [
      [{ text: 'RL · MP', cls: 'sb-purple' }],
      [{ text: 'YK · SN · AH', cls: 'sb-purple' }],
      [{ text: 'DT · RL', cls: 'sb-purple' }],
      [{ text: 'MP · YK', cls: 'sb-purple' }],
      [{ text: 'RL · DT · AH', cls: 'sb-purple' }],
      [{ text: 'SN · YK · MP', cls: 'sb-purple' }],
      [{ text: 'AH', cls: 'sb-purple' }, { text: '1 unfilled', cls: 'sb-amber' }],
    ],
  },
];


// ─── [HARDCODED] SMART ASSIGN RECOMMENDATIONS ────────────────────────────────
// Replace with: GET /api/schedule/recommend?shiftId=<id>&role=<role>
// Returns: ranked list with availability, skill match, rest gap, workload scores (0–100)
export const RECOMMENDATIONS = [
  {
    rank: 1,                                         // [HARDCODED] server-computed rank
    name: 'David Tan',                               // [HARDCODED]
    skills: ['Floor Service', 'Cashier'],             // [HARDCODED] matched skill tags
    reason: 'Available · 10h rest gap met · 32h this week (below avg — good for balance)', // [HARDCODED] AI-generated rationale
    scores: { avail: 95, skill: 100, rest: 88, load: 90 }, // [HARDCODED] 0–100 per scoring factor
    top: true,                                       // [HARDCODED] highlight #1 pick
  },
  {
    rank: 2,
    name: 'Maya Patel',
    skills: ['Floor Service', 'Kitchen'],
    reason: 'Available · Rest gap borderline (9.5h) · 22h this week — underloaded',
    scores: { avail: 85, skill: 80, rest: 65, load: 100 },
    top: false,
  },
  {
    rank: 3,
    name: 'Yusuf Kim',
    skills: ['Cashier'],
    reason: 'Available · Skill partial match · 40h this week — slightly above avg',
    scores: { avail: 80, skill: 60, rest: 90, load: 55 },
    top: false,
  },
];


// ─── [HARDCODED] APPROVAL QUEUE ───────────────────────────────────────────────
// Replace with:
//   GET  /api/requests?status=pending&outlet=<id>
//   PATCH /api/requests/:id  body: { status: 'approved' | 'denied' }
export const APPROVAL_ITEMS = [
  {
    id: 1,                                           // [HARDCODED] request ID from DB
    icon: 'ti-exchange',                             // icon derived from request type — keep in frontend
    iconBg: 'var(--amber)',
    iconColor: 'var(--amber-t)',
    title: 'Shift swap — David ↔ Sarah',             // [HARDCODED] built from request fields
    detail: 'Sat 15 Jun, Evening shift · Both parties agreed', // [HARDCODED]
    urgency: 'pending',                              // [HARDCODED] 'pending' | 'urgent'
  },
  {
    id: 2,
    icon: 'ti-calendar-off',
    iconBg: 'var(--blue)',
    iconColor: 'var(--blue-t)',
    title: 'Leave request — Maya Patel',
    detail: '20–22 Jun · Annual leave · 3 days',
    urgency: 'pending',
  },
  {
    id: 3,
    icon: 'ti-user-plus',
    iconBg: 'var(--purple)',
    iconColor: 'var(--purple-t)',
    title: 'Replacement — Sun 16 Morning',
    detail: 'Yusuf called out sick · Urgent coverage needed',
    urgency: 'urgent',
  },
  {
    id: 4,
    icon: 'ti-calendar-off',
    iconBg: 'var(--blue)',
    iconColor: 'var(--blue-t)',
    title: 'Leave request — Amy Hassan',
    detail: '28 Jun · Off-day · Single day',
    urgency: 'pending',
  },
];


// ─── [HARDCODED] STAFF AVAILABILITY ──────────────────────────────────────────
// Replace with:
//   GET /api/availability?staffId=<id>&week=26
//   PUT /api/availability   body: { staffId, week, slots: [...] }
// Grid: rows = periods (Morning/Afternoon/Evening), cols = days (Mon–Sun)
// Cell values: 'yes' | 'maybe' | 'no'
export const AVAIL_INIT = [
  ['yes', 'no',  'yes', 'yes', 'no',  'yes',   'no'],  // [HARDCODED] Morning row
  ['yes', 'yes', 'no',  'no',  'yes', 'maybe', 'yes'], // [HARDCODED] Afternoon row
  ['no',  'yes', 'yes', 'yes', 'no',  'yes',   'yes'], // [HARDCODED] Evening row
];

// Static UI labels — not from backend
export const AVAIL_DAYS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const AVAIL_PERIODS = ['Morning', 'Afternoon', 'Evening'];


// ─── [HARDCODED] WORKLOAD BALANCE ────────────────────────────────────────────
// Replace with: GET /api/reports/workload?week=25&outlet=<id>
// Returns: per-staff hours this week, percentage of team average, warning flag
export const WORKLOAD = [
  { id: 'RL', cls: 'ma-blue',   hours: '32h',   pct: 78,  warn: false }, // [HARDCODED]
  { id: 'DT', cls: 'ma-green',  hours: '42h',   pct: 100, warn: false }, // [HARDCODED]
  { id: 'SN', cls: 'ma-purple', hours: '38h',   pct: 90,  warn: false }, // [HARDCODED]
  { id: 'MP', cls: 'ma-amber',  hours: '22h ⚠', pct: 55,  warn: true  }, // [HARDCODED] warn when <80% of avg
  { id: 'YK', cls: 'ma-purple', hours: '40h',   pct: 95,  warn: false }, // [HARDCODED]
];


// ─── UPDATED NAV (includes new screens) ───────────────────────────────────────
// Overwrite the existing MANAGER_NAV / STAFF_NAV / COORD_NAV exports above
// with these expanded versions when wiring up the new screens.
export const MANAGER_NAV_V2 = [
  { id: 'dashboard',    icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { id: 'schedule',     icon: 'ti-calendar-week',    label: 'Schedule' },
  { id: 'staff',        icon: 'ti-users',             label: 'Staff' },
  { id: 'clockin',      icon: 'ti-login',             label: 'Clock In' },
  { id: 'approval',     icon: 'ti-check-circle',      label: 'Approval Queue' },
  { id: 'krewby',       icon: 'ti-briefcase',         label: 'Krewby Requests' },
  null,
  { id: 'ai',           icon: 'ti-message-bolt',      label: 'AI Assistant' },
  { id: 'reports',      icon: 'ti-chart-bar',         label: 'Reports' },
  null,
  { id: 'settings',     icon: 'ti-settings',          label: 'Settings' },
];

export const STAFF_NAV_V2 = [
  { id: 'myshift',      icon: 'ti-calendar-user', label: 'My Schedule' },
  { id: 'availability', icon: 'ti-clock-check',   label: 'My Availability' },
  null,
  { id: 'account',      icon: 'ti-user-circle',   label: 'My Account' },
];

export const COORD_NAV_V2 = [
  { id: 'krewby',   icon: 'ti-briefcase',    label: 'Krewby Requests' },
  null,
  { id: 'ai',       icon: 'ti-message-bolt', label: 'AI Assistant' },
  { id: 'reports',  icon: 'ti-chart-bar',    label: 'Reports' },
  null,
  { id: 'account',  icon: 'ti-user-circle',  label: 'My Account' },
];

// Updated screen titles for new screens
export const SCREEN_TITLES_V2 = {
  dashboard:       'Dashboard',
  schedule:        'Shift Schedule',
  recommend:       'Smart Assign',
  shiftdetail:     'Shift Detail',
  staff:           'Staff Management',
  staffprofile:    'Staff Profile',
  clockin:         'Clock In / Out',
  approval:        'Approval Queue',
  krewby:          'Krewby Requests',
  workerprofile:   'Worker Profile',
  ai:              'AI Workforce Assistant',
  reports:         'Reports & Attendance',
  myshift:         'My Schedule',
  availability:    'My Availability',
  notifications:   'Notifications',
  settings:        'Settings',
  account:         'My Account',
};
