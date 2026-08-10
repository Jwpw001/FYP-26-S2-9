// Round 4, Task 1 — single source of truth for "where does clicking this notification go?".
// Replaces two diverging copies of this logic (one in the shared NotificationsPage.jsx, a
// simpler duplicate in manager/Notifications.jsx) that had drifted apart, including one actual
// dead link (business_registered → "/admin/businesses", which isn't a real route).
//
// Role-aware because the same related_entity means a different page per role — a leave request
// opens the manager's approval queue for a manager, the staff member's own leave page for staff.
//
// Record-specific where a detail route with an :id param actually exists for that role (manager
// shift/staff detail pages, business-owner/system-admin staff detail, system-admin business
// detail); otherwise falls back to the relevant list page. Per the task's own instruction: if the
// page doesn't support deep-linking to one record, just navigate to the page — no highlight
// system is built here.
//
// Returns a path string, or null if there's nothing sensible to navigate to (caller must treat
// null as "not clickable" — never navigate to a guessed/dead route).
export function resolveNotificationLink({ type, relatedEntity, relatedId }, role) {
  const id = relatedId ?? null;

  // task_assignments' related_id is documented (see backend audit) as the SHIFT's id, not the
  // assignment's own id — "shift" (singular, from casual_assigned) is the same concept under a
  // different string. All three resolve identically.
  if (relatedEntity === "shifts" || relatedEntity === "shift" || relatedEntity === "task_assignments" || type?.includes("shift") || type === "assignment" || type?.includes("assign")) {
    if (role === "manager") return id ? `/manager/shifts/${id}` : "/manager/shifts";
    if (role === "regular_staff") return "/regular-staff/shifts"; // no per-shift detail route for staff
    if (role === "casual_staff") return "/casual-staff/shifts";
    return null;
  }

  if (relatedEntity === "availability" || type?.includes("leave")) {
    if (role === "manager") return "/manager/availability";
    if (role === "regular_staff") return "/regular-staff/leave";
    return null; // casual staff don't use this leave system (they use casual_availability)
  }

  if (relatedEntity === "off_day_requests" || type?.includes("off_day")) {
    if (role === "manager") return "/manager/availability";
    if (role === "regular_staff") return "/regular-staff/leave";
    return null;
  }

  if (relatedEntity === "swap_requests" || type?.includes("swap")) {
    if (role === "manager") return "/manager/availability";
    if (role === "regular_staff") return "/regular-staff/swaps";
    if (role === "casual_staff") return "/casual-staff/swap-requests";
    return null;
  }

  // Round 6, Task 7: gap escalation reminders and "casual now matches unfilled tasks" pings both
  // point at the gaps view — related_id here is a branch_id, not a per-record deep link.
  if (relatedEntity === "shift_gaps" || type === "gap_escalation" || type === "casual_matches_gaps") {
    if (role === "manager") return "/manager/gaps";
    return null; // business owners are notified at the urgent tier but have no gaps page of their own
  }

  if (relatedEntity === "casual_availability" || type === "availability_reminder") {
    // related_id here is a staff_id, not useful for deep-linking any existing page — list-level.
    if (role === "manager") return "/manager/availability"; // has a Casual Availability tab
    if (role === "casual_staff") return "/casual-staff/availability";
    return null;
  }

  if (relatedEntity === "timesheets" || type?.includes("report")) {
    if (role === "manager") return "/manager/attendance";
    if (role === "regular_staff") return "/regular-staff/shifts"; // reports live under a tab there
    if (role === "casual_staff") return "/casual-staff/shifts";
    return null;
  }

  if (relatedEntity === "staff" || type === "staff_offboarded") {
    if (role === "manager") return id ? `/manager/staff/${id}` : "/manager/staff";
    if (role === "business_owner") return id ? `/business-owner/staff/${id}` : "/business-owner/staff";
    if (role === "system_admin") return id ? `/system-admin/staff/${id}` : "/system-admin/staff";
    return null;
  }

  if (relatedEntity === "casual_worker" || type === "casual_approved" || type === "casual_rejected") {
    // Sent to the casual worker themselves — casual_workers.id isn't a page they have access to;
    // their own dashboard shows their current status, which is what the notification is about.
    if (role === "casual_staff") return "/casual-staff/dashboard";
    return null;
  }

  if (relatedEntity === "businesses" || type === "business_registered") {
    if (role === "system_admin") return id ? `/system-admin/businesses/${id}` : "/system-admin/businesses";
    return null;
  }

  return null;
}
