const prisma        = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUser, notifyUsers, getBranchManagerUserIds } = require("../utils/notify");
const { logAudit } = require("../utils/auditLog");
const logger = require("../config/logger");

const sendServerError = require("../utils/sendServerError");
// Prisma returns date/time columns as JS Date objects, which Express serializes to full ISO
// strings (e.g. "1970-01-01T09:00:00.000Z" for a `time` column, "2026-07-18T00:00:00.000Z" for
// a `date` column). Frontend code was written against Supabase-direct's plain "HH:MM:SS" /
// "YYYY-MM-DD" strings, so responses built from Prisma must be normalized to match or every date
// formatter downstream breaks ("Invalid Date", "1970", NaN durations, etc).
function toHHMMSS(t) {
  if (!t) return null;
  const s = t instanceof Date ? t.toISOString() : String(t);
  return s.includes("T") ? s.slice(11, 19) : s;
}
function toDateOnly(d) {
  if (!d) return null;
  const s = d instanceof Date ? d.toISOString() : String(d);
  return s.includes("T") ? s.slice(0, 10) : s;
}
function normalizeShift(shift) {
  if (!shift) return shift;
  return { ...shift, shift_date: toDateOnly(shift.shift_date), start_time: toHHMMSS(shift.start_time), end_time: toHHMMSS(shift.end_time) };
}
function normalizeTask(task) {
  if (!task) return task;
  return { ...task, start_time: toHHMMSS(task.start_time), end_time: toHHMMSS(task.end_time) };
}

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

function toMinsFromISO(t) {
  if (!t) return null;
  const hhmm = new Date(t).toISOString().slice(11, 16);
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Returns an error message if assigning `staffId` to `shiftId` would violate the branch's
// max daily hours or max consecutive working days — null if the assignment is fine.
//
// `prefetched` (Round 7, P1 finding T-02) lets a caller checking many candidates against the
// SAME shift/branch — casualController.js's autoAssignCasual candidate loop — supply the shift,
// branch_settings, and a { [staffId]: otherAssignments[] } map it already fetched once for every
// candidate, so this function does zero DB round trips per call instead of two. Omitted (the
// single-candidate caller below, assignStaff) falls back to fetching them itself, unchanged.
async function checkLaborRules(staffId, shiftId, branchId, prefetched = {}) {
  const shift = prefetched.shift ?? await prisma.shifts.findUnique({
    where: { shift_id: shiftId },
    select: { shift_date: true, start_time: true, end_time: true },
  });
  if (!shift) return null;

  let settings = prefetched.settings;
  if (settings === undefined) {
    const result = await supabaseAdmin
      .from("branch_settings")
      .select("max_work_hours_day, max_consecutive_days, allow_overtime")
      .eq("branch_id", branchId)
      .maybeSingle();
    settings = result.data;
  }
  if (!settings) return null;

  const maxHours  = settings.max_work_hours_day || 12;
  const maxConsec = settings.max_consecutive_days || 6;
  const allowOT   = settings.allow_overtime ?? false;
  const shiftDateStr = new Date(shift.shift_date).toISOString().slice(0, 10);

  let otherAssignments;
  if (prefetched.otherAssignmentsByStaffId) {
    otherAssignments = prefetched.otherAssignmentsByStaffId[staffId] || [];
  } else {
    // Bounded to `maxConsec` days either side of the target shift (previously unbounded — every
    // assignment a staff member had ever had, growing without limit over the lifetime of the
    // app). A consecutive-day run only needs to reach maxConsec+1 to violate the rule, and days
    // further out than maxConsec on either side can't change that pass/fail outcome, so this
    // window is provably sufficient for the rule check (the reported day-count in a genuinely
    // pathological run far longer than the window could undercount, but the violation itself,
    // and every real-world case, is unaffected).
    const shiftDateMs = new Date(`${shiftDateStr}T00:00:00Z`).getTime();
    const windowStart = new Date(shiftDateMs - maxConsec * 86400000);
    const windowEnd = new Date(shiftDateMs + maxConsec * 86400000);
    otherAssignments = await prisma.task_assignments.findMany({
      where: { staff_id: staffId, shift_id: { not: shiftId }, shifts: { shift_date: { gte: windowStart, lte: windowEnd } } },
      include: { shifts: { select: { shift_date: true, start_time: true, end_time: true } } },
    });
  }

  if (!allowOT) {
    const sameDayHours = otherAssignments
      .filter(a => a.shifts && new Date(a.shifts.shift_date).toISOString().slice(0, 10) === shiftDateStr)
      .reduce((sum, a) => sum + Math.max(0, (toMinsFromISO(a.shifts.end_time) - toMinsFromISO(a.shifts.start_time)) / 60), 0);
    const thisShiftHours = Math.max(0, (toMinsFromISO(shift.end_time) - toMinsFromISO(shift.start_time)) / 60);
    const totalHours = sameDayHours + thisShiftHours;
    if (totalHours > maxHours) {
      return `This would put the staff member at ${totalHours.toFixed(1)}h on ${shiftDateStr}, over the branch's ${maxHours}h/day limit (overtime isn't enabled for this branch).`;
    }
  }

  const oneDay = 86400000;
  const datesSet = new Set(
    otherAssignments.filter(a => a.shifts).map(a => new Date(a.shifts.shift_date).toISOString().slice(0, 10))
  );
  datesSet.add(shiftDateStr);
  const targetMs = new Date(`${shiftDateStr}T00:00:00Z`).getTime();
  let run = 1;
  for (let d = targetMs - oneDay; datesSet.has(new Date(d).toISOString().slice(0, 10)); d -= oneDay) run++;
  for (let d = targetMs + oneDay; datesSet.has(new Date(d).toISOString().slice(0, 10)); d += oneDay) run++;
  if (run > maxConsec) {
    return `This would put the staff member on ${run} consecutive working days, over the branch's ${maxConsec}-day limit.`;
  }

  return null;
}

// Double-booking check — Task G2: advisory only, mirrors checkLaborRules above. Does this staff
// member already have another assignment on this date whose shift time overlaps the shift they
// were just assigned to? Returns one warning string per overlapping assignment (usually 0 or 1).
async function checkDoubleBooking(staffId, shiftId, taskId, staffName) {
  const shift = await prisma.shifts.findUnique({
    where: { shift_id: shiftId },
    select: { shift_date: true, start_time: true, end_time: true },
  });
  if (!shift) return [];

  const overlapping = await prisma.task_assignments.findMany({
    where: {
      staff_id: staffId,
      task_id: { not: taskId },
      shifts: {
        shift_date: shift.shift_date,
        start_time: { lt: shift.end_time },
        end_time: { gt: shift.start_time },
      },
    },
    include: {
      shift_tasks: { select: { title: true } },
      shifts: { select: { start_time: true, end_time: true } },
    },
  });

  return overlapping.map(a =>
    `${staffName} is already assigned to ${a.shift_tasks?.title || "another task"} on this date (${toHHMMSS(a.shifts.start_time)?.slice(0, 5)}–${toHHMMSS(a.shifts.end_time)?.slice(0, 5)})`
  );
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

const getShiftTasks = async (req, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const tasks = await prisma.shift_tasks.findMany({
      where: { shift_id: shiftId },
      include: {
        skills: { select: { skill_id: true, name: true } },
        task_assignments: {
          include: {
            staff: {
              include: { users: { select: { user_id: true, full_name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { task_id: "asc" },
    });
    res.json({ success: true, tasks });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const createTask = async (req, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const { title, description, skill_id, start_time, end_time } = req.body;

    if (!title?.trim()) return res.status(400).json({ success: false, message: "Task title is required." });

    const shift = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { shift_id: true, branch_id: true } });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });

    const callerBranchId = await getCallerBranchId(req.user.user_id);
    if (callerBranchId && shift.branch_id !== callerBranchId) {
      return res.status(403).json({ success: false, message: "You don't have access to this shift." });
    }

    const { difficulty } = req.body;
    const task = await prisma.shift_tasks.create({
      data: {
        shift_id: shiftId,
        title: title.trim(),
        description: description || null,
        skill_id: skill_id || null,
        difficulty: difficulty || null,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : null,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null,
        status: "open",
      },
      include: { skills: { select: { skill_id: true, name: true } } },
    });
    res.status(201).json({ success: true, task });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const updateTask = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { title, description, skill_id, difficulty, start_time, end_time, status } = req.body;

    const existing = await prisma.shift_tasks.findUnique({ where: { task_id: taskId }, include: { shifts: { select: { branch_id: true } } } });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found." });

    const callerBranchId = await getCallerBranchId(req.user.user_id);
    if (callerBranchId && existing.shifts.branch_id !== callerBranchId) {
      return res.status(403).json({ success: false, message: "You don't have access to this task." });
    }

    const task = await prisma.shift_tasks.update({
      where: { task_id: taskId },
      data: {
        title: title?.trim() || existing.title,
        description: description !== undefined ? description : existing.description,
        skill_id: skill_id !== undefined ? (skill_id || null) : existing.skill_id,
        difficulty: difficulty !== undefined ? (difficulty || null) : existing.difficulty,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : existing.start_time,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : existing.end_time,
        status: status || existing.status,
      },
      include: { skills: { select: { skill_id: true, name: true } } },
    });
    res.json({ success: true, task });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const deleteTask = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const existing = await prisma.shift_tasks.findUnique({ where: { task_id: taskId }, include: { shifts: { select: { branch_id: true } } } });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found." });

    const callerBranchId = await getCallerBranchId(req.user.user_id);
    if (callerBranchId && existing.shifts.branch_id !== callerBranchId) {
      return res.status(403).json({ success: false, message: "You don't have access to this task." });
    }

    await prisma.shift_tasks.delete({ where: { task_id: taskId } });
    res.json({ success: true, message: "Task deleted." });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

// ── Assignments ────────────────────────────────────────────────────────────────

const assignStaff = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { staff_id } = req.body;

    if (!staff_id) return res.status(400).json({ success: false, message: "staff_id is required." });

    const task = await prisma.shift_tasks.findUnique({
      where: { task_id: taskId },
      select: { shift_id: true, status: true, shifts: { select: { branch_id: true } } },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    const callerBranchId = await getCallerBranchId(req.user.user_id);
    if (callerBranchId && task.shifts.branch_id !== callerBranchId) {
      return res.status(403).json({ success: false, message: "You don't have access to this task." });
    }

    // One task = one person: reject if already assigned
    const existing = await prisma.task_assignments.findFirst({ where: { task_id: taskId } });
    if (existing) return res.status(409).json({ success: false, message: "Task already has an assignee. Remove the current assignee first." });

    // ── Labor-rule check — Round 3, Task 5: advisory, not blocking. No single hour cap fits
    // every business, and a manager who gets blocked works around the system instead of using
    // it. The assignment always proceeds; a breach is surfaced as a warning in the response
    // (and logged below) so the manager decides with the information in front of them, and
    // Task 6's report can flag it later.
    const laborWarning = await checkLaborRules(Number(staff_id), task.shift_id, task.shifts.branch_id);

    const assignment = await prisma.task_assignments.create({
      data: {
        task_id: taskId,
        shift_id: task.shift_id,
        staff_id: Number(staff_id),
        status: "assigned",
      },
      include: {
        staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } },
        shift_tasks: { select: { title: true } },
      },
    });

    // Update task status to assigned
    await prisma.shift_tasks.update({ where: { task_id: taskId }, data: { status: "assigned" } });

    try {
      const shift = await prisma.shifts.findUnique({ where: { shift_id: task.shift_id }, select: { shift_date: true, title: true } });
      const dateStr = shift?.shift_date ? new Date(shift.shift_date).toISOString().slice(0, 10) : "";
      await notifyUser({
        recipientId: assignment.staff?.users?.user_id,
        type: "shift_assigned",
        title: "New Shift Assignment",
        message: `You've been assigned to ${assignment.shift_tasks?.title || "a task"} on ${dateStr}${shift?.title ? ` (${shift.title})` : ""}.`,
        relatedEntity: "task_assignments",
        relatedId: task.shift_id,
      });
    } catch { /* notification failure shouldn't block assignment */ }

    await logAudit({
      actorId: req.user.user_id, action: "staff_assigned", entity: "task_assignments", entityId: assignment.assignment_id,
      before: null, after: { task_id: taskId, staff_id: Number(staff_id), labor_warning: laborWarning || null },
    });
    // A second, distinctly-actioned audit entry specifically for the labor-rule breach itself —
    // easy to find/filter later ("staff_assigned" entries wouldn't be) even though Task 6's
    // report recomputes warnings fresh from the final roster rather than reading these back (see
    // that task's own notes: many assignments — regular-staff auto-population, casual
    // auto-allocation — never call checkLaborRules at all, so a report built from persisted
    // warnings alone would be systematically incomplete).
    if (laborWarning) {
      await logAudit({
        actorId: req.user.user_id, action: "labor_rule_warning", entity: "task_assignments", entityId: assignment.assignment_id,
        before: null, after: { task_id: taskId, staff_id: Number(staff_id), warning: laborWarning },
      });
    }

    const warnings = await checkDoubleBooking(
      Number(staff_id), task.shift_id, taskId, assignment.staff?.users?.full_name || "This staff member"
    );

    res.status(201).json({ success: true, assignment, warning: laborWarning || null, ...(warnings.length > 0 ? { warnings } : {}) });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const unassignStaff = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);

    const assignment = await prisma.task_assignments.findFirst({
      where: { task_id: taskId },
      include: {
        staff: { include: { users: { select: { user_id: true } } } },
        shift_tasks: { select: { title: true } },
        shifts: { select: { branch_id: true } },
      },
    });
    if (!assignment) return res.status(404).json({ success: false, message: "No assignment found for this task." });

    const callerBranchId = await getCallerBranchId(req.user.user_id);
    if (callerBranchId && assignment.shifts.branch_id !== callerBranchId) {
      return res.status(403).json({ success: false, message: "You don't have access to this task." });
    }

    await prisma.task_assignments.delete({ where: { assignment_id: assignment.assignment_id } });
    await prisma.shift_tasks.update({ where: { task_id: taskId }, data: { status: "open" } });

    try {
      const shift = await prisma.shifts.findUnique({ where: { shift_id: assignment.shift_id }, select: { shift_date: true } });
      const dateStr = shift?.shift_date ? new Date(shift.shift_date).toISOString().slice(0, 10) : "";
      await notifyUser({
        recipientId: assignment.staff?.users?.user_id,
        type: "shift_unassigned",
        title: "Shift Assignment Removed",
        message: `You've been removed from ${assignment.shift_tasks?.title || "a task"} on ${dateStr}.`,
        relatedEntity: "task_assignments",
        relatedId: assignment.shift_id,
      });
    } catch { /* notification failure shouldn't block unassignment */ }

    await logAudit({
      actorId: req.user.user_id, action: "staff_unassigned", entity: "task_assignments", entityId: assignment.assignment_id,
      before: { task_id: taskId, staff_id: assignment.staff_id }, after: null,
    });

    res.json({ success: true, message: "Staff unassigned from task." });
  } catch (error) {
    sendServerError(res, error, req);
  }
};


// Staff: get my tasks for a shift
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const staffRow = await prisma.staff.findFirst({ where: { user_id: userId }, select: { staff_id: true } });
    if (!staffRow) return res.json({ success: true, tasks: [] });

    // Staff should never see shifts that haven't been published yet — a draft is still being
    // built by the manager and its assignments/tasks may change before it goes live.
    const assignments = await prisma.task_assignments.findMany({
      where: {
        staff_id: staffRow.staff_id,
        shifts: { status: { not: "draft" } },
        NOT: {
          swap_requests_swap_requests_requester_assignTotask_assignments: {
            some: { status: "approved" },
          },
        },
      },
      include: {
        shift_tasks: {
          include: { skills: { select: { skill_id: true, name: true } } },
        },
        shifts: { select: { shift_id: true, branch_id: true, title: true, shift_date: true, start_time: true, end_time: true, status: true, branches: { select: { name: true } } } },
      },
      orderBy: { shifts: { shift_date: "asc" } },
    });

    const normalized = assignments.map(a => ({
      ...a,
      shifts: normalizeShift(a.shifts),
      shift_tasks: normalizeTask(a.shift_tasks),
    }));

    res.json({ success: true, assignments: normalized });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

// ── Gaps view (Round 6, Task 7a) ─────────────────────────────────────────────────

// Urgency buckets for unfilled tasks, in escalating-then-later order. The round spec names four
// buckets — Tomorrow / This week / Next week / Later — with no fifth bucket for "today". A task
// whose shift is today is at least as urgent as one tomorrow, so it's folded into the "Tomorrow"
// bucket rather than invented a new label; this is a deliberate choice, not an oversight.
function urgencyBucket(shiftDateStr, tomorrowStr, weekEndStr, nextWeekEndStr) {
  if (shiftDateStr <= tomorrowStr) return "Tomorrow"; // today, overdue, or tomorrow — most urgent tier
  if (shiftDateStr <= weekEndStr) return "This week";
  if (shiftDateStr <= nextWeekEndStr) return "Next week";
  return "Later";
}

// GET /api/shifts/gaps — every unfilled (status "open") task on an upcoming, non-cancelled shift
// in the calling manager's branch, grouped by urgency and sorted ascending within each group.
const getUnfilledTasks = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(404).json({ success: false, message: "Branch not found." });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    // Week boundaries follow the same Mon-Sun convention as branch_settings.operating_days /
    // casual_availability elsewhere in the app (Mon=0…Sun=6).
    const dow = (today.getUTCDay() + 6) % 7; // Mon=0…Sun=6
    const weekEnd = new Date(today.getTime() + (6 - dow) * 86400000);
    const nextWeekEnd = new Date(weekEnd.getTime() + 7 * 86400000);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const nextWeekEndStr = nextWeekEnd.toISOString().slice(0, 10);

    const openTasks = await prisma.shift_tasks.findMany({
      where: {
        status: "open",
        shifts: { branch_id: branchId, status: { not: "cancelled" }, shift_date: { gte: today } },
      },
      select: {
        task_id: true, title: true, skill_id: true, start_time: true, end_time: true,
        skills: { select: { skill_id: true, name: true } },
        shifts: { select: { shift_id: true, title: true, shift_date: true, status: true } },
      },
      orderBy: [{ shifts: { shift_date: "asc" } }, { start_time: "asc" }],
    });

    const gaps = openTasks.map(t => {
      const shiftDateStr = toDateOnly(t.shifts.shift_date);
      return {
        task_id: t.task_id,
        title: t.title,
        skill: t.skills ? { skill_id: t.skills.skill_id, name: t.skills.name } : null,
        start_time: toHHMMSS(t.start_time),
        end_time: toHHMMSS(t.end_time),
        shift_id: t.shifts.shift_id,
        shift_title: t.shifts.title,
        shift_status: t.shifts.status,
        shift_date: shiftDateStr,
        urgency: urgencyBucket(shiftDateStr, tomorrowStr, weekEndStr, nextWeekEndStr),
      };
    });

    return res.json({ success: true, gaps });
  } catch (error) {
    return sendServerError(res, error, req);
  }
};

// ── Staff Roster ───────────────────────────────────────────────────────────────

const getStaffRoster = async (req, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const shift = await prisma.shifts.findUnique({
      where: { shift_id: shiftId },
      select: { shift_date: true, branch_id: true, start_time: true, end_time: true, period_id: true },
    });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    const callerBranchId = await getCallerBranchId(req.user.user_id);
    if (callerBranchId && shift.branch_id !== callerBranchId) {
      return res.status(403).json({ success: false, message: "You don't have access to this shift." });
    }

    const shiftDateStr = shift.shift_date.toISOString().slice(0, 10);
    const shiftDate    = new Date(shiftDateStr + "T00:00:00Z");
    const branchId     = shift.branch_id;

    // Regular staff belong to exactly one branch. Casual staff are pool-based — they're a
    // candidate for a branch only if they've listed it as a preference, regardless of which
    // branch their staff row was originally created under.
    const regularStaff = await prisma.staff.findMany({
      where: { branch_id: branchId, staff_type: "regular", is_active: true },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } },
    });

    const { data: prefRows } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branchId);
    const preferredUserIds = [...new Set((prefRows || []).map(r => r.user_id))];

    const casualStaff = preferredUserIds.length > 0
      ? await prisma.staff.findMany({
          where: { user_id: { in: preferredUserIds }, staff_type: "casual", is_active: true },
          include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } },
        })
      : [];

    const staffList = [...regularStaff, ...casualStaff];
    const filtered = staffList.filter(s => s.users?.role !== "manager");

    // The staff table's real per-staff-member column is exp_level, not experience_level (that
    // name only exists on user_skill_tags, a different, per-skill field) — selecting
    // "experience_level" here always 42703'd against a live DB and silently returned no rows, so
    // expLevelByStaffId was always empty and every candidate showed as unrated.
    const { data: expLevelRows } = await supabaseAdmin
      .from("staff")
      .select("staff_id, exp_level")
      .in("staff_id", filtered.map(s => s.staff_id));
    const expLevelByStaffId = Object.fromEntries((expLevelRows || []).map(r => [r.staff_id, r.exp_level]));

    const EXP_RANK = { junior: 1, mid: 2, senior: 3, expert: 4 };
    // staff.exp_level uses a 3-tier scale (beginner/intermediate/expert); map onto the
    // 4-tier task-difficulty scale used above.
    const EXP_LEVEL_MAP = { beginner: "junior", intermediate: "mid", expert: "expert" };
    const mapExpLevel = s => EXP_LEVEL_MAP[expLevelByStaffId[s.staff_id]] || null;
    const staffIds = filtered.map(s => s.staff_id);
    const userIds  = filtered.map(s => s.user_id).filter(Boolean);

    // Skills — use supabaseAdmin to get experience_level per skill
    const { data: skillTagRows } = await supabaseAdmin
      .from("user_skill_tags")
      .select("user_id, skill_id, experience_level")
      .in("user_id", userIds);
    const skillIds = [...new Set((skillTagRows || []).map(r => r.skill_id))];
    const skillRecords = skillIds.length > 0
      ? await prisma.skills.findMany({ where: { skill_id: { in: skillIds } }, select: { skill_id: true, name: true } })
      : [];
    const skillNameMap = Object.fromEntries(skillRecords.map(s => [s.skill_id, s.name]));
    const skillMap = {};
    (skillTagRows || []).forEach(st => {
      const name = skillNameMap[st.skill_id];
      if (!name) return;
      if (!skillMap[st.user_id]) skillMap[st.user_id] = [];
      skillMap[st.user_id].push({ skill_id: st.skill_id, name, experience_level: st.experience_level || null });
    });

    // Leave (approved leave requests)
    const leaveRows = await prisma.availability.findMany({
      where: { staff_id: { in: staffIds }, status: "approved", start_date: { lte: shiftDate }, end_date: { gte: shiftDate } },
      select: { staff_id: true },
    });
    // Off day requests approved for this exact date (Supabase-only table)
    const { data: offDayRows = [] } = await supabaseAdmin
      .from("off_day_requests")
      .select("staff_id")
      .in("staff_id", staffIds)
      .eq("status", "approved")
      .eq("requested_date", shiftDateStr);
    const onLeaveIds = new Set([
      ...leaveRows.map(l => l.staff_id),
      ...offDayRows.map(o => o.staff_id),
    ]);

    // Double-booked on same date (other shifts)
    const otherAssignments = await prisma.task_assignments.findMany({
      where: { staff_id: { in: staffIds }, shift_id: { not: shiftId } },
      include: { shifts: { select: { shift_id: true, shift_date: true, title: true, start_time: true, end_time: true } } },
    });
    const toMinsFromISO = t => {
      if (!t) return null;
      const hhmm = new Date(t).toISOString().slice(11, 16);
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const thisStart = toMinsFromISO(shift.start_time);
    const thisEnd   = toMinsFromISO(shift.end_time);

    const sameDayAssignments = otherAssignments.filter(
      a => a.shifts?.shift_date?.toISOString().slice(0, 10) === shiftDateStr
    );

    const conflictingOnDate = sameDayAssignments.filter(a => {
      const otherStart = toMinsFromISO(a.shifts?.start_time);
      const otherEnd   = toMinsFromISO(a.shifts?.end_time);
      if (thisStart == null || thisEnd == null || otherStart == null || otherEnd == null) return true;
      return thisStart < otherEnd && thisEnd > otherStart;
    });
    const doubleBookedIds = new Set(conflictingOnDate.map(a => a.staff_id));
    const doubleBookedShiftMap = {};
    conflictingOnDate.forEach(a => {
      if (!doubleBookedShiftMap[a.staff_id] && a.shifts) {
        doubleBookedShiftMap[a.staff_id] = {
          title:      a.shifts.title || "Shift",
          start_time: a.shifts.start_time ? new Date(a.shifts.start_time).toISOString().slice(11, 16) : null,
          end_time:   a.shifts.end_time   ? new Date(a.shifts.end_time).toISOString().slice(11, 16)   : null,
        };
      }
    });

    // Same day but no time conflict
    const otherShiftIds = new Set(conflictingOnDate.map(a => a.staff_id));
    const otherShiftMap = {};
    sameDayAssignments.forEach(a => {
      if (!otherShiftIds.has(a.staff_id) && !otherShiftMap[a.staff_id] && a.shifts) {
        otherShiftMap[a.staff_id] = {
          title:      a.shifts.title || "Shift",
          start_time: a.shifts.start_time ? new Date(a.shifts.start_time).toISOString().slice(11, 16) : null,
          end_time:   a.shifts.end_time   ? new Date(a.shifts.end_time).toISOString().slice(11, 16)   : null,
        };
      }
    });

    // Already assigned to this shift
    const alreadyAssigned = await prisma.task_assignments.findMany({
      where: { shift_id: shiftId, staff_id: { in: staffIds } },
      select: { staff_id: true, task_id: true },
    });
    const assignedIds    = new Set(alreadyAssigned.map(a => a.staff_id));
    const assignedTaskMap = {};
    alreadyAssigned.forEach(a => { assignedTaskMap[a.staff_id] = a.task_id; });

    // Hours this week
    const weekStart = new Date(shiftDate);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const weekAssignments = await prisma.task_assignments.findMany({
      where: { staff_id: { in: staffIds }, shifts: { shift_date: { gte: weekStart, lte: weekEnd } } },
      include: { shifts: { select: { start_time: true, end_time: true } } },
    });
    const hoursMap = {};
    weekAssignments.forEach(a => {
      if (!a.staff_id || !a.shifts?.start_time || !a.shifts?.end_time) return;
      const h = (new Date(a.shifts.end_time) - new Date(a.shifts.start_time)) / 3600000;
      hoursMap[a.staff_id] = (hoursMap[a.staff_id] || 0) + h;
    });

    // Casual availability for shift day — day_of_week in this table is Monday-indexed (Mon=0…Sun=6),
    // not JS's native Sunday=0, so convert before querying. Must also match the specific week the
    // shift falls in — a worker may have submitted different hours for different weeks.
    const shiftDow        = (shiftDate.getUTCDay() + 6) % 7;
    const shiftWeekStart  = new Date(shiftDate);
    shiftWeekStart.setUTCDate(shiftWeekStart.getUTCDate() - shiftDow);
    const casualIds  = filtered.filter(s => s.staff_type === "casual").map(s => s.staff_id);
    const casualAvailMap = {}; // staff_id -> { from: "HH:MM"|null, to: "HH:MM"|null }
    // Round 6, Task 6 moved casual availability to a period-based system (casual_period_availability
    // for explicit weekly picks, casual_standing_availability as the "usual pattern" fallback when
    // nothing's been explicitly submitted for the week) — the current Availability UI no longer
    // writes to the legacy time-range casual_availability table queried below, so a shift with a
    // period only resolves correctly through the new tables. Branches with no periods configured
    // (shift.period_id null) keep the old table/behaviour unchanged.
    const shiftPeriodId = shift.period_id;
    const casualPeriodMatchMap = {}; // staff_id -> boolean, only populated when shiftPeriodId is set
    if (casualIds.length > 0 && shiftPeriodId) {
      const [explicitRows, standingRows] = await Promise.all([
        prisma.casual_period_availability.findMany({
          where: { staff_id: { in: casualIds }, week_start_date: shiftWeekStart },
          select: { staff_id: true, period_id: true },
        }),
        prisma.casual_standing_availability.findMany({
          where: { staff_id: { in: casualIds }, day_of_week: shiftDow },
          select: { staff_id: true, period_id: true },
        }),
      ]);
      const explicitPeriodsByStaffId = {};
      explicitRows.forEach(r => {
        if (!explicitPeriodsByStaffId[r.staff_id]) explicitPeriodsByStaffId[r.staff_id] = new Set();
        explicitPeriodsByStaffId[r.staff_id].add(r.period_id);
      });
      const standingPeriodsByStaffId = {};
      standingRows.forEach(r => {
        if (!standingPeriodsByStaffId[r.staff_id]) standingPeriodsByStaffId[r.staff_id] = new Set();
        standingPeriodsByStaffId[r.staff_id].add(r.period_id);
      });
      casualIds.forEach(staffId => {
        const explicit = explicitPeriodsByStaffId[staffId];
        casualPeriodMatchMap[staffId] = explicit
          ? explicit.has(shiftPeriodId)
          : (standingPeriodsByStaffId[staffId]?.has(shiftPeriodId) || false);
      });
    } else if (casualIds.length > 0) {
      const avail = await prisma.casual_availability.findMany({
        where: { staff_id: { in: casualIds }, day_of_week: shiftDow, week_start_date: shiftWeekStart },
        select: { staff_id: true, available_from: true, available_to: true },
      });
      avail.forEach(a => {
        casualAvailMap[a.staff_id] = {
          from: a.available_from ? new Date(a.available_from).toISOString().slice(11, 16) : null,
          to:   a.available_to   ? new Date(a.available_to).toISOString().slice(11, 16)   : null,
        };
      });
    }

    const shiftStartHH = new Date(shift.start_time).toISOString().slice(11, 16);
    const shiftEndHH   = new Date(shift.end_time).toISOString().slice(11, 16);

    const roster = filtered.map(s => ({
      staff_id:              s.staff_id,
      full_name:             s.users?.full_name || "Unknown",
      email:                 s.users?.email || "",
      staff_type:            s.staff_type,
      exp_level:             mapExpLevel(s),
      hired_at:              s.hired_at || null,
      skills:                skillMap[s.user_id] || [],
      is_on_leave:           onLeaveIds.has(s.staff_id),
      is_double_booked:      doubleBookedIds.has(s.staff_id),
      double_booked_shift:   doubleBookedShiftMap[s.staff_id] || null,
      other_shift_today:     otherShiftMap[s.staff_id] || null,
      already_assigned:      assignedIds.has(s.staff_id),
      assigned_task_id:      assignedTaskMap[s.staff_id] || null,
      hours_this_week:       Math.round((hoursMap[s.staff_id] || 0) * 10) / 10,
      casual_available_today: (() => {
        if (s.staff_type !== "casual") return null;
        if (shiftPeriodId) return casualPeriodMatchMap[s.staff_id] || false;
        const avail = casualAvailMap[s.staff_id];
        if (!avail) return false; // no declaration for this week/day
        const { from, to } = avail;
        if (!from && !to) return true; // declared with no specific times = available all day
        // Declared window must cover the entire shift (start at or before shift start, end at or after shift end)
        return !!from && !!to && from <= shiftStartHH && to >= shiftEndHH;
      })(),
      casual_avail_from:      s.staff_type === "casual" ? (casualAvailMap[s.staff_id]?.from ?? null) : null,
      casual_avail_to:        s.staff_type === "casual" ? (casualAvailMap[s.staff_id]?.to ?? null) : null,
    }));

    res.json({ success: true, roster });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

// ── AI Validate Assignment ─────────────────────────────────────────────────────

const validateAssignment = async (req, res) => {
  try {
    const taskId  = Number(req.params.taskId);
    const { staff_id, roster } = req.body;
    if (!staff_id) return res.status(400).json({ success: false, message: "staff_id required" });

    const task = await prisma.shift_tasks.findUnique({
      where: { task_id: taskId },
      include: {
        skills: { select: { skill_id: true, name: true } },
      },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const selected = (roster || []).find(r => r.staff_id === Number(staff_id));
    if (!selected) return res.json({ success: true, suitable: true, message: "Assignment saved." });

    const EXP_RANK  = { junior: 1, mid: 2, senior: 3, expert: 4 };
    const taskSkill = task.skills?.name || null;
    const hasSkill  = !task.skill_id || selected.skills.some(s => s.skill_id === task.skill_id);
    const taskDiffRank  = EXP_RANK[task.difficulty] || 0;
    const staffExpRank  = EXP_RANK[selected.exp_level] || 0;
    const underQualified = task.difficulty && selected.exp_level && staffExpRank < taskDiffRank;
    const toHHMM    = t => { if (!t) return ""; const s = t instanceof Date ? t.toISOString() : String(t); return s.includes("T") ? s.slice(11,16) : s.slice(0,5); };
    const yearsOfService = selected.hired_at
      ? Math.max(0, Math.floor((Date.now() - new Date(selected.hired_at).getTime()) / (365.25 * 24 * 3600 * 1000)))
      : null;

    const toMins = hhmm => { if (!hhmm) return null; const [h,m] = hhmm.split(":").map(Number); return h*60+m; };
    function casualCoversTask(r) {
      if (r.staff_type !== "casual") return true;
      if (!r.casual_available_today) return false;
      const taskStart = toMins(toHHMM(task.start_time));
      const taskEnd   = toMins(toHHMM(task.end_time));
      if (taskStart == null || taskEnd == null) return true;
      const availFrom = toMins(r.casual_avail_from);
      const availTo   = toMins(r.casual_avail_to);
      if (availFrom == null || availTo == null) return true;
      return availFrom <= taskStart && availTo >= taskEnd;
    }
    function availLabel(r) {
      if (r.staff_type !== "casual") return null;
      if (!r.casual_available_today) return "not available for this shift's period";
      // Period-based availability (the current system) has no specific time window — a period
      // match is binary, so casual_avail_from/to are null here and there's nothing to declare.
      if (!r.casual_avail_from && !r.casual_avail_to) return "available for this shift's period (via weekly submission or usual pattern)";
      const covers = casualCoversTask(r);
      return `declared ${r.casual_avail_from||"?"}–${r.casual_avail_to||"?"}${covers ? " (covers task)" : " (does NOT cover task hours)"}`;
    }
    const selectedCoversTask = casualCoversTask(selected);

    const alternatives = (roster || [])
      .filter(r =>
        r.staff_id !== Number(staff_id) &&
        !r.already_assigned && !r.is_on_leave && !r.is_double_booked &&
        (!task.skill_id || r.skills.some(s => s.skill_id === task.skill_id)) &&
        casualCoversTask(r)
      )
      .sort((a, b) => a.hours_this_week - b.hours_this_week)
      .slice(0, 2);

    // Deterministic hard-fail: a casual whose declared hours don't cover the task is a clear-cut
    // problem — don't leave catching it up to the LLM's instruction-following.
    if (selected.staff_type === "casual" && !selectedCoversTask) {
      const best = alternatives[0];
      return res.json({
        success: true,
        suitable: false,
        message: `${selected.full_name}'s declared availability (${availLabel(selected)}) does not cover this task's hours (${toHHMM(task.start_time)}–${toHHMM(task.end_time)}).`,
        alternative: best ? { name: best.full_name, reason: `Available and covers the task hours, with ${best.hours_this_week}h already worked this week.` } : null,
      });
    }

    const OpenAI = require("openai");
    const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a smart F&B workforce scheduling AI. Evaluate this staff assignment and respond in JSON only.

Task: "${task.title}"${taskSkill ? ` (requires: ${taskSkill})` : " (no specific skill required)"}
Task difficulty: ${task.difficulty ? task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1) : "Not set"}
Task hours: ${toHHMM(task.start_time)}–${toHHMM(task.end_time)}

Assigned: ${selected.full_name} (${selected.staff_type})
- Experience level: ${selected.exp_level ? selected.exp_level.charAt(0).toUpperCase() + selected.exp_level.slice(1) : "Not set"}
- Years of service: ${yearsOfService !== null ? `${yearsOfService} yr${yearsOfService !== 1 ? "s" : ""}` : "Unknown"}
- Meets difficulty requirement: ${underQualified ? "No (under-qualified)" : "Yes"}
- Skills: ${selected.skills.map(s => s.name).join(", ") || "None"}
- Has required skill: ${hasSkill ? "Yes" : "No"}
- Hours this week: ${selected.hours_this_week}h
- On leave today: ${selected.is_on_leave ? "Yes" : "No"}
${selected.staff_type === "casual" ? `- Availability: ${availLabel(selected)}` : ""}

${alternatives.length > 0
  ? `Available alternatives (have skill, no conflicts, and if casual their availability covers the task hours):\n${alternatives.map(a => `- ${a.full_name}: ${a.hours_this_week}h this week, skills: ${a.skills.map(s=>s.name).join(", ")||"none"}${a.staff_type==="casual" ? `, availability: ${availLabel(a)}` : ""}`).join("\n")}`
  : "No better alternatives available."}

IMPORTANT: Never suggest a casual staff member as an alternative unless their availability window fully covers the task's hours (${toHHMM(task.start_time)}–${toHHMM(task.end_time)}). If the assigned person's availability does NOT cover the task hours, that is a serious problem worth flagging even if their skills/experience are otherwise fine.

Respond ONLY with this JSON (no other text):
{ "suitable": true or false, "message": "1-2 sentence assessment", "alternative": null or { "name": "Name", "reason": "why they are a better fit in one sentence" } }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.15,
    });

    const raw   = completion.choices[0].message.content;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ success: true, suitable: true, message: "Assignment looks good." });

    const result = JSON.parse(match[0]);
    res.json({ success: true, ...result });
  } catch {
    res.json({ success: true, suitable: true, message: "Assignment saved successfully." });
  }
};

module.exports = { getShiftTasks, createTask, updateTask, deleteTask, assignStaff, unassignStaff, getMyTasks, getUnfilledTasks, getStaffRoster, validateAssignment, checkLaborRules, checkDoubleBooking };
