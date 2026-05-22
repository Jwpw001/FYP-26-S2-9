// ─────────────────────────────────────────────────────────────────────────────
// api.js — Central API service layer
// All fetch calls go through here. When a backend endpoint is ready,
// swap the mock return for the real fetch call in that function.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Helper: attach auth token to every request ────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem('krewby_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Helper: unified fetch wrapper ─────────────────────────────────────────────
async function request(method, path, body = null) {
  const opts = {
    method,
    headers: authHeaders(),
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    // Throw the backend's error message if available
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Returns: { success, token, user: { id, name, email, role } }
 */
export async function apiLogin(email, password) {
  const data = await request('POST', '/auth/login', { email, password });
  if (data.token) localStorage.setItem('krewby_token', data.token);
  return data;
}

/**
 * POST /api/auth/register
 */
export async function apiRegister(payload) {
  return request('POST', '/auth/register', payload);
}

/**
 * Clear token and log out
 */
export function apiLogout() {
  localStorage.removeItem('krewby_token');
}

/**
 * GET /api/auth/me
 * Returns logged-in user profile
 */
export async function apiGetMe() {
  return request('GET', '/auth/me');
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF  —  GET /api/staff
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetStaff() {
  return request('GET', '/staff');
}

export async function apiGetStaffById(id) {
  return request('GET', `/staff/${id}`);
}

export async function apiUpdateStaff(id, payload) {
  return request('PATCH', `/staff/${id}`, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD  —  GET /api/dashboard/summary
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetDashboardSummary() {
  return request('GET', '/dashboard/summary');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE  —  GET /api/schedule
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetSchedule(week, year) {
  return request('GET', `/schedule?week=${week}&year=${year}`);
}

export async function apiPublishSchedule(week, year) {
  return request('POST', '/schedule/publish', { week, year });
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART ASSIGN  —  GET /api/schedule/recommend
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetRecommendations(shiftId, role) {
  return request('GET', `/schedule/recommend?shiftId=${shiftId}&role=${encodeURIComponent(role)}`);
}

export async function apiAssignStaff(shiftId, slotRole, staffId) {
  return request('PATCH', '/schedule/assign', { shiftId, slotRole, staffId });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUESTS / APPROVAL  —  GET /api/requests
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetRequests(status = 'pending') {
  return request('GET', `/requests?status=${status}`);
}

export async function apiUpdateRequest(id, status, note = '') {
  return request('PATCH', `/requests/${id}`, { status, note });
}

export async function apiCreateRequest(payload) {
  return request('POST', '/requests', payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY  —  GET /api/availability
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetAvailability(staffId, week) {
  return request('GET', `/availability?staffId=${staffId}&week=${week}`);
}

export async function apiSaveAvailability(staffId, week, slots) {
  return request('PUT', '/availability', { staffId, week, slots });
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE  —  GET /api/attendance/today
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetAttendanceToday() {
  return request('GET', '/attendance/today');
}

export async function apiClockIn(staffId, shiftId) {
  return request('POST', '/attendance/clockin', { staffId, shiftId });
}

export async function apiClockOut(staffId, shiftId) {
  return request('POST', '/attendance/clockout', { staffId, shiftId });
}

// ─────────────────────────────────────────────────────────────────────────────
// KREWBY REQUESTS  —  GET /api/krewby/requests
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetKrewbyRequests() {
  return request('GET', '/krewby/requests');
}

export async function apiCreateKrewbyRequest(payload) {
  return request('POST', '/krewby/requests', payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS  —  GET /api/reports
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetReportsSummary(month) {
  return request('GET', `/reports/summary?month=${month}`);
}

export async function apiGetWorkload(week) {
  return request('GET', `/reports/workload?week=${week}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS  —  GET /api/notifications
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetNotifications() {
  return request('GET', '/notifications');
}

export async function apiMarkNotificationRead(id) {
  return request('PATCH', `/notifications/${id}/read`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS  —  GET /api/settings
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetSettings() {
  return request('GET', '/settings');
}

export async function apiSaveSettings(payload) {
  return request('PATCH', '/settings', payload);
}
