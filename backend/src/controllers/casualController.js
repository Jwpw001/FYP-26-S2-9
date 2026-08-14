const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const generateToken = require("../utils/generateToken");
const { notifyUser, notifyUsers, notifyUsersBatched, getBranchManagerUserIds } = require("../utils/notify");
const { checkLaborRules } = require("./taskController");
const sendServerError = require("../utils/sendServerError");
const logger = require("../config/logger");
const {
  toMinutesFromTimeValue,
  doTimeRangesOverlap,
  getUTCDayOfWeekMondayFirst,
  getUTCMondayWeekStart,
  computeWeightedScore,
} = require("../utils/scheduling");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(4)}-${rand(4)}`;
}

async function resolveManagerBranch(userId) {
  const { data: link } = await supabaseAdmin
    .from("branch_managers")
    .select("branch_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!link) return null;
  const branch = await prisma.branches.findUnique({
    where: { branch_id: link.branch_id },
    select: { branch_id: true, business_id: true, name: true },
  });
  return branch || null;
}

async function resolveOwnerBusiness(userId) {
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("business_id, name, join_code")
    .eq("owner_id", userId)
    .maybeSingle();
  return biz || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

async function registerCasualWorker(req, res) {
  try {
    const { full_name, username: rawUsername, email, password, join_code, bio } = req.body;

    if (!full_name || !rawUsername || !email || !password || !join_code) {
      return res.status(400).json({ success: false, message: "All fields and a valid join code are required." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const username = rawUsername.trim().toLowerCase();

    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("business_id, name")
      .eq("join_code", join_code.trim().toUpperCase())
      .maybeSingle();

    if (!biz) {
      return res.status(404).json({ success: false, message: "Invalid join code. Please check with your employer." });
    }

    const existingEmail = await prisma.users.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const existingUsername = await prisma.users.findFirst({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: "This username is already taken." });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) return res.status(400).json({ success: false, message: authErr.message });

    const newUser = await prisma.users.create({
      data: { full_name, username, email, role: "casual_staff", is_active: true },
    });

    const { error: cwErr } = await supabaseAdmin.from("casual_workers").insert({
      user_id: newUser.user_id,
      business_id: biz.business_id,
      status: "pending",
      bio: bio || null,
    });
    if (cwErr) throw new Error(cwErr.message);

    // Give them a staff_id (no branch — pool-based) so scheduling/availability/skills all work
    // once approved. Stays inactive until a business owner approves them.
    await prisma.staff.create({
      data: { user_id: newUser.user_id, branch_id: null, staff_type: "casual", is_active: false },
    });

    const token = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: `Application submitted! ${biz.name} will review and approve your account.`,
      token,
      user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
      approval_status: "pending",
    });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASUAL WORKER — status + branch preferences
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/me
async function getCasualWorkerStatus(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("id, business_id, status, bio, joined_at, approved_at")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    let businessName = null;
    if (cw.business_id) {
      const { data: biz } = await supabaseAdmin.from("businesses").select("name").eq("business_id", cw.business_id).maybeSingle();
      businessName = biz?.name || null;
    }

    return res.json({ success: true, casual_worker: { ...cw, business_name: businessName } });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// GET /api/casual/my-branches — list all branches in the worker's business
async function getMyBranches(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    const { data: branches } = await supabaseAdmin
      .from("branches")
      .select("branch_id, name, address")
      .eq("business_id", cw.business_id)
      .is("deleted_at", null)
      .order("name");

    return res.json({ success: true, branches: branches || [], approval_status: cw.status });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// GET /api/casual/preferences — get preferred branch IDs
async function getPreferences(req, res) {
  try {
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("branch_id")
      .eq("user_id", req.user.user_id);

    return res.json({ success: true, preferred_branch_ids: (prefs || []).map(p => p.branch_id) });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// PUT /api/casual/preferences — replace preferred branches { branch_ids: [1,2,3] }
async function setPreferences(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    const { branch_ids } = req.body;
    if (!Array.isArray(branch_ids)) {
      return res.status(400).json({ success: false, message: "branch_ids must be an array." });
    }

    // Delete existing, then insert new ones
    await supabaseAdmin.from("casual_branch_preferences").delete().eq("user_id", req.user.user_id);

    if (branch_ids.length > 0) {
      const rows = branch_ids.map(id => ({ user_id: req.user.user_id, branch_id: id }));
      const { error } = await supabaseAdmin.from("casual_branch_preferences").insert(rows);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: "Branch preferences saved.", preferred_branch_ids: branch_ids });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASUAL WORKER — weekly availability
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/availability
async function getMyAvailability(req, res) {
  try {
    const { data: rows } = await supabaseAdmin
      .from("casual_weekly_availability")
      .select("id, day_of_week, available_from, available_to")
      .eq("user_id", req.user.user_id)
      .order("day_of_week");
    return res.json({ success: true, availability: rows || [] });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// PUT /api/casual/availability  body: { availability: [{day_of_week, available_from, available_to}] }
async function setMyAvailability(req, res) {
  try {
    const { availability } = req.body;
    if (!Array.isArray(availability)) {
      return res.status(400).json({ success: false, message: "availability must be an array." });
    }
    // Replace all existing rows
    await supabaseAdmin.from("casual_weekly_availability").delete().eq("user_id", req.user.user_id);
    if (availability.length > 0) {
      const rows = availability.map(a => ({
        user_id: req.user.user_id,
        day_of_week: a.day_of_week,
        available_from: a.available_from,
        available_to: a.available_to,
      }));
      const { error } = await supabaseAdmin.from("casual_weekly_availability").insert(rows);
      if (error) throw new Error(error.message);
    }
    return res.json({ success: true, message: "Availability saved." });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// POST /api/casual/availability/submit  body: { week_start_date, availability: [{day_of_week, available_from, available_to}] }
async function submitWeeklyAvailability(req, res) {
  try {
    const { week_start_date, availability } = req.body;
    if (!week_start_date || !Array.isArray(availability)) {
      return res.status(400).json({ success: false, message: "week_start_date and availability array required." });
    }

    const userId = req.user.user_id;

    // Get staff record for this user
    const { data: staffRecord } = await supabaseAdmin
      .from("staff")
      .select("staff_id, branch_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!staffRecord) return res.status(404).json({ success: false, message: "Staff record not found." });

    // Replace this week's rows in casual_availability
    await supabaseAdmin.from("casual_availability")
      .delete()
      .eq("staff_id", staffRecord.staff_id)
      .eq("week_start_date", week_start_date);

    if (availability.length > 0) {
      const rows = availability.map(a => ({
        staff_id:       staffRecord.staff_id,
        week_start_date,
        day_of_week:    a.day_of_week,
        available_from: a.available_from,
        available_to:   a.available_to,
      }));
      const { error } = await supabaseAdmin.from("casual_availability").insert(rows);
      if (error) throw new Error(error.message);
    }

    // Also sync to casual_weekly_availability so the dashboard count stays accurate
    await supabaseAdmin.from("casual_weekly_availability").delete().eq("user_id", userId);
    if (availability.length > 0) {
      const weeklyRows = availability.map(a => ({
        user_id:        userId,
        day_of_week:    a.day_of_week,
        available_from: a.available_from,
        available_to:   a.available_to,
      }));
      await supabaseAdmin.from("casual_weekly_availability").insert(weeklyRows);
    }

    // Notify manager(s)
    const user = await prisma.users.findUnique({ where: { user_id: userId }, select: { full_name: true } });
    if (staffRecord.branch_id) {
      const managerIds = await getBranchManagerUserIds(staffRecord.branch_id);
      const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const summary = availability.length > 0
        ? availability.map(a => `${DN[a.day_of_week]} ${a.available_from?.slice(0,5)}–${a.available_to?.slice(0,5)}`).join(", ")
        : "No availability set";
      await notifyUsers(managerIds, {
        type:           "casual_availability",
        title:          `${user?.full_name || "Casual worker"} submitted availability`,
        message:        `Week of ${week_start_date}: ${summary}`,
        relatedEntity:  "casual_availability",
        relatedId:      staffRecord.staff_id,
      });
    }

    return res.json({ success: true, message: "Availability submitted." });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASUAL WORKER — period-based availability (Round 6, Task 6)
//
// Replaces the day×time-range grid above with a day×period grid: a casual ticks the shift
// periods they can work rather than typing free-form hours. Two tables back this:
//   - casual_period_availability: explicit picks for one specific week. If a staff member has
//     ANY row for a week, that week is resolved from these rows alone — a period not ticked is
//     unavailable, it does not fall through to the standing pattern below.
//   - casual_standing_availability: a recurring "usually available" pattern (period × weekday),
//     used only for weeks where the staff member has submitted nothing explicit at all.
// The old casual_availability/casual_weekly_availability tables and their endpoints above are
// left in place untouched (existing rows stay as history) — this UI simply stops writing to
// them going forward.
// ─────────────────────────────────────────────────────────────────────────────

function toHHMM(v) {
  if (!v) return null;
  const s = v instanceof Date ? v.toISOString() : String(v);
  return s.includes("T") ? s.slice(11, 16) : s.slice(0, 5);
}

// Periods across every branch the casual has marked as preferred (falls back to every branch in
// their business if they haven't set branch preferences yet, so the grid is never empty).
async function activePeriodsForCasual(userId, businessId) {
  const { data: prefs } = await supabaseAdmin
    .from("casual_branch_preferences")
    .select("branch_id")
    .eq("user_id", userId);
  let branchIds = (prefs || []).map(p => p.branch_id);

  if (branchIds.length === 0) {
    const { data: branches } = await supabaseAdmin
      .from("branches")
      .select("branch_id")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    branchIds = (branches || []).map(b => b.branch_id);
  }
  if (branchIds.length === 0) return [];

  const periods = await prisma.branch_shift_periods.findMany({
    where: { branch_id: { in: branchIds }, is_active: true },
    select: { period_id: true, branch_id: true, name: true, start_time: true, end_time: true, active_days: true, sort_order: true, branches: { select: { name: true } } },
    orderBy: [{ branch_id: "asc" }, { sort_order: "asc" }],
  });
  return periods.map(p => ({
    period_id: p.period_id,
    branch_id: p.branch_id,
    branch_name: p.branches?.name || null,
    name: p.name,
    start_time: toHHMM(p.start_time),
    end_time: toHHMM(p.end_time),
    active_days: p.active_days,
  }));
}

async function resolveCasualStaff(userId) {
  const { data: cw } = await supabaseAdmin
    .from("casual_workers")
    .select("business_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!cw) return null;
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("staff_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!staffRow) return null;
  return { staffId: staffRow.staff_id, businessId: cw.business_id };
}

// GET /api/casual/period-availability?week_start_date=YYYY-MM-DD
async function getPeriodAvailability(req, res) {
  try {
    const { week_start_date } = req.query;
    if (!week_start_date) return res.status(400).json({ success: false, message: "week_start_date is required." });

    const resolved = await resolveCasualStaff(req.user.user_id);
    if (!resolved) return res.status(404).json({ success: false, message: "Casual worker record not found." });
    const { staffId, businessId } = resolved;

    const periods = await activePeriodsForCasual(req.user.user_id, businessId);

    const [explicitRows, standingRows] = await Promise.all([
      prisma.casual_period_availability.findMany({
        where: { staff_id: staffId, week_start_date: new Date(`${week_start_date}T00:00:00.000Z`) },
        select: { period_id: true, day_of_week: true },
      }),
      prisma.casual_standing_availability.findMany({
        where: { staff_id: staffId },
        select: { period_id: true, day_of_week: true },
      }),
    ]);

    const standingByPeriod = {};
    standingRows.forEach(r => {
      if (!standingByPeriod[r.period_id]) standingByPeriod[r.period_id] = [];
      standingByPeriod[r.period_id].push(r.day_of_week);
    });

    return res.json({
      success: true,
      week_start_date,
      periods,
      explicit_period_ids: [...new Set(explicitRows.map(r => r.period_id))],
      // OPT 5: per (period_id, day_of_week) rows so the grid can pre-fill exact cells —
      // day_of_week null means "whole week" for that period (the pre-OPT-5 row shape).
      explicit_entries: explicitRows.map(r => ({ period_id: r.period_id, day_of_week: r.day_of_week })),
      has_explicit_submission: explicitRows.length > 0,
      standing_by_period: standingByPeriod,
    });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// Round 6, Task 7c: given a casual's just-saved period picks for a week, find any unfilled
// (status "open") tasks that fall on one of those periods that week, and notify each affected
// branch's manager(s) once (batched — one message per manager, even across multiple branches).
async function notifyManagersOfMatchingGaps({ staffUserId, weekDate, periodIds, weekStartDateStr }) {
  const weekEnd = new Date(weekDate.getTime() + 7 * 86400000);
  const matchingTasks = await prisma.shift_tasks.findMany({
    where: {
      status: "open",
      period_id: { in: periodIds },
      shifts: { status: { not: "cancelled" }, shift_date: { gte: weekDate, lt: weekEnd } },
    },
    select: { task_id: true, shifts: { select: { branch_id: true } } },
  });
  if (matchingTasks.length === 0) return;

  const countByBranch = {};
  matchingTasks.forEach(t => {
    countByBranch[t.shifts.branch_id] = (countByBranch[t.shifts.branch_id] || 0) + 1;
  });

  const user = await prisma.users.findUnique({ where: { user_id: staffUserId }, select: { full_name: true } });
  const name = user?.full_name || "A casual worker";

  const entries = [];
  for (const [branchIdStr, count] of Object.entries(countByBranch)) {
    const branchId = Number(branchIdStr);
    const managerIds = await getBranchManagerUserIds(branchId);
    const plural = count !== 1 ? "s" : "";
    const title = `${name} is now available for ${count} unfilled task${plural}`;
    const message = `Week of ${weekStartDateStr}: check the Gaps view to assign them.`;
    managerIds.forEach(uid => entries.push({ recipientId: uid, type: "casual_matches_gaps", title, message, relatedEntity: "shift_gaps", relatedId: branchId }));
  }
  if (entries.length > 0) await notifyUsersBatched(entries);
}

// GET /api/casual/period-availability/history — recent weeks with an explicit submission, most
// recent first, so the UI can show "explicitly set" weeks vs weeks silently covered by pattern.
async function getPeriodAvailabilityHistory(req, res) {
  try {
    const resolved = await resolveCasualStaff(req.user.user_id);
    if (!resolved) return res.status(404).json({ success: false, message: "Casual worker record not found." });
    const { staffId, businessId } = resolved;

    const periods = await activePeriodsForCasual(req.user.user_id, businessId);
    const periodById = Object.fromEntries(periods.map(p => [p.period_id, p]));

    const rows = await prisma.casual_period_availability.findMany({
      where: { staff_id: staffId },
      select: { week_start_date: true, period_id: true },
      orderBy: { week_start_date: "desc" },
    });

    const grouped = {};
    rows.forEach(r => {
      const wk = r.week_start_date.toISOString().slice(0, 10);
      if (!grouped[wk]) grouped[wk] = [];
      const p = periodById[r.period_id];
      grouped[wk].push({ period_id: r.period_id, name: p?.name || "Unknown period", branch_name: p?.branch_name || null });
    });

    const history = Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([week_start_date, periods]) => ({ week_start_date, periods }));

    return res.json({ success: true, history });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// PUT /api/casual/period-availability
// body: { week_start_date, period_ids: [1,2,3] }                          — legacy: whole week per period
//    or: { week_start_date, periods: [{ period_id, days: [0,2] }, { period_id }] } — OPT 5: optional
//        per-day picks; a period entry with no (or empty) `days` still means "whole week", same as
//        listing it in the legacy period_ids.
async function setPeriodAvailability(req, res) {
  try {
    const { week_start_date, period_ids, periods: periodEntries } = req.body;
    const hasLegacyShape = Array.isArray(period_ids);
    const hasNewShape = Array.isArray(periodEntries);
    if (!week_start_date || (!hasLegacyShape && !hasNewShape)) {
      return res.status(400).json({ success: false, message: "week_start_date and period_ids (or periods) array required." });
    }

    const resolved = await resolveCasualStaff(req.user.user_id);
    if (!resolved) return res.status(404).json({ success: false, message: "Casual worker record not found." });
    const { staffId, businessId } = resolved;

    // Only accept period_ids that actually belong to this casual's business — guards against a
    // crafted request writing availability against another business's periods.
    const validPeriods = await activePeriodsForCasual(req.user.user_id, businessId);
    const validIds = new Set(validPeriods.map(p => p.period_id));

    // Normalize both request shapes into one list of { period_id, days } before validating.
    const rawEntries = hasNewShape
      ? periodEntries.map(e => ({ period_id: Number(e.period_id), days: Array.isArray(e.days) ? e.days : [] }))
      : period_ids.map(id => ({ period_id: Number(id), days: [] }));

    const entriesByPeriod = new Map(); // period_id -> Set(day_of_week) ; empty Set = whole week
    for (const e of rawEntries) {
      if (!validIds.has(e.period_id)) continue;
      const days = e.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
      if (!entriesByPeriod.has(e.period_id)) entriesByPeriod.set(e.period_id, new Set());
      days.forEach(d => entriesByPeriod.get(e.period_id).add(d));
    }
    const cleanIds = [...entriesByPeriod.keys()];
    const weekDate = new Date(`${week_start_date}T00:00:00.000Z`);

    const rows = [];
    for (const [period_id, daySet] of entriesByPeriod) {
      if (daySet.size === 0) {
        rows.push({ staff_id: staffId, week_start_date: weekDate, period_id });
      } else {
        daySet.forEach(day_of_week => rows.push({ staff_id: staffId, week_start_date: weekDate, period_id, day_of_week }));
      }
    }

    await prisma.casual_period_availability.deleteMany({ where: { staff_id: staffId, week_start_date: weekDate } });
    if (rows.length > 0) {
      await prisma.casual_period_availability.createMany({ data: rows });
    }

    // Round 6, Task 7c: tell the manager(s) when this submission means the casual is now
    // available for unfilled tasks — informational only, this never auto-assigns anyone
    // (availability means "could work", not "put me on anything"). Fires whenever the just-saved
    // state has at least one match; not diffed against what was submitted before, so resaving the
    // same periods can notify again — a deliberate simplification, not a spec requirement.
    // Best-effort: a notification failure here must not undo the availability save above.
    if (cleanIds.length > 0) {
      try {
        await notifyManagersOfMatchingGaps({ staffUserId: req.user.user_id, weekDate, periodIds: cleanIds, weekStartDateStr: week_start_date });
      } catch (notifyErr) {
        logger.error({ err: notifyErr }, "[setPeriodAvailability] gap-match notification failed");
      }
    }

    return res.json({ success: true, message: "Availability saved.", period_ids: cleanIds });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// GET /api/casual/standing-availability
async function getStandingAvailability(req, res) {
  try {
    const resolved = await resolveCasualStaff(req.user.user_id);
    if (!resolved) return res.status(404).json({ success: false, message: "Casual worker record not found." });
    const { staffId, businessId } = resolved;

    const periods = await activePeriodsForCasual(req.user.user_id, businessId);
    const standingRows = await prisma.casual_standing_availability.findMany({
      where: { staff_id: staffId },
      select: { period_id: true, day_of_week: true },
    });

    return res.json({
      success: true,
      periods,
      standing: standingRows.map(r => ({ period_id: r.period_id, day_of_week: r.day_of_week })),
    });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// PUT /api/casual/standing-availability  body: { entries: [{period_id, day_of_week}] }
async function setStandingAvailability(req, res) {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: "entries array required." });
    }

    const resolved = await resolveCasualStaff(req.user.user_id);
    if (!resolved) return res.status(404).json({ success: false, message: "Casual worker record not found." });
    const { staffId, businessId } = resolved;

    const validPeriods = await activePeriodsForCasual(req.user.user_id, businessId);
    const validIds = new Set(validPeriods.map(p => p.period_id));
    const seen = new Set();
    const cleanEntries = [];
    for (const e of entries) {
      const periodId = Number(e?.period_id);
      const dow = Number(e?.day_of_week);
      if (!validIds.has(periodId) || !Number.isInteger(dow) || dow < 0 || dow > 6) continue;
      const key = `${periodId}:${dow}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cleanEntries.push({ staff_id: staffId, period_id: periodId, day_of_week: dow });
    }

    await prisma.casual_standing_availability.deleteMany({ where: { staff_id: staffId } });
    if (cleanEntries.length > 0) {
      await prisma.casual_standing_availability.createMany({ data: cleanEntries });
    }

    return res.json({ success: true, message: "Usual pattern saved.", entries: cleanEntries.map(e => ({ period_id: e.period_id, day_of_week: e.day_of_week })) });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// POST /api/casual/period-availability/set-as-standing  body: { week_start_date }
// Adopts this week's explicit picks as the recurring pattern: for each period ticked this week,
// the standing pattern is set to every weekday that period actually runs (branch_shift_periods
// .active_days) — replacing only the standing rows for those specific periods, leaving any other
// period's existing standing pattern untouched.
async function setWeekAsStandingPattern(req, res) {
  try {
    const { week_start_date } = req.body;
    if (!week_start_date) return res.status(400).json({ success: false, message: "week_start_date is required." });

    const resolved = await resolveCasualStaff(req.user.user_id);
    if (!resolved) return res.status(404).json({ success: false, message: "Casual worker record not found." });
    const { staffId, businessId } = resolved;

    const weekDate = new Date(`${week_start_date}T00:00:00.000Z`);
    const explicitRows = await prisma.casual_period_availability.findMany({
      where: { staff_id: staffId, week_start_date: weekDate },
      select: { period_id: true },
    });
    if (explicitRows.length === 0) {
      return res.json({ success: true, message: "Nothing set for this week yet — nothing to save as your usual pattern.", entries: [] });
    }

    const periods = await activePeriodsForCasual(req.user.user_id, businessId);
    const periodById = Object.fromEntries(periods.map(p => [p.period_id, p]));
    const explicitIds = explicitRows.map(r => r.period_id).filter(id => periodById[id]);

    await prisma.casual_standing_availability.deleteMany({ where: { staff_id: staffId, period_id: { in: explicitIds } } });

    const newRows = [];
    explicitIds.forEach(periodId => {
      const activeDays = periodById[periodId].active_days || "1111111";
      for (let dow = 0; dow < 7; dow++) {
        if (activeDays[dow] === "1") newRows.push({ staff_id: staffId, period_id: periodId, day_of_week: dow });
      }
    });
    if (newRows.length > 0) {
      await prisma.casual_standing_availability.createMany({ data: newRows });
    }

    return res.json({ success: true, message: "Saved as your usual pattern.", entries: newRows.map(r => ({ period_id: r.period_id, day_of_week: r.day_of_week })) });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER — casual pool for their branch
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/manager/pool — workers who prefer this branch
async function getManagerPool(req, res) {
  try {
    const branch = await resolveManagerBranch(req.user.user_id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found for this manager." });

    // Get all users who have this branch as a preference and are approved
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branch.branch_id);

    const userIds = (prefs || []).map(p => p.user_id);
    if (userIds.length === 0) return res.json({ success: true, workers: [] });

    // Filter to approved workers only
    const { data: approved } = await supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status, bio, approved_at")
      .eq("business_id", branch.business_id)
      .eq("status", "approved")
      .in("user_id", userIds);

    const enriched = await Promise.all((approved || []).map(async (w) => {
      const user = await prisma.users.findUnique({
        where: { user_id: w.user_id },
        select: { full_name: true, email: true, username: true, avatar_url: true },
      });
      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills(name)")
        .eq("user_id", w.user_id);

      // How many other branches they prefer
      const { count: branchCount } = await supabaseAdmin
        .from("casual_branch_preferences")
        .select("*", { count: "exact", head: true })
        .eq("user_id", w.user_id);

      return {
        ...w,
        full_name: user?.full_name,
        email: user?.email,
        username: user?.username,
        avatar_url: user?.avatar_url || "/avatars/default.png",
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        branch_count: branchCount || 1,
      };
    }));

    return res.json({ success: true, workers: enriched });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// GET /api/casual/manager/period-availability — this branch's casual roster's period picks
// (casual_period_availability), expanded to one entry per (staff, week, day) using each period's
// active_days so the calendar can render it exactly like the old per-day time-range table did,
// just showing the period name instead of a time range.
async function getManagerPeriodAvailability(req, res) {
  try {
    const branch = await resolveManagerBranch(req.user.user_id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found for this manager." });

    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branch.branch_id);
    const prefUserIds = (prefs || []).map(p => p.user_id);
    if (prefUserIds.length === 0) return res.json({ success: true, availability: [] });

    const { data: approved } = await supabaseAdmin
      .from("casual_workers")
      .select("user_id")
      .eq("business_id", branch.business_id)
      .eq("status", "approved")
      .in("user_id", prefUserIds);
    const approvedUserIds = (approved || []).map(w => w.user_id);
    if (approvedUserIds.length === 0) return res.json({ success: true, availability: [] });

    const staffRows = await prisma.staff.findMany({
      where: { user_id: { in: approvedUserIds }, staff_type: "casual", is_active: true },
      select: { staff_id: true },
    });
    const staffIds = staffRows.map(s => s.staff_id);
    if (staffIds.length === 0) return res.json({ success: true, availability: [] });

    const rows = await prisma.casual_period_availability.findMany({
      where: { staff_id: { in: staffIds } },
      select: {
        id: true, staff_id: true, week_start_date: true, period_id: true,
        branch_shift_periods: { select: { name: true, active_days: true } },
      },
      orderBy: { week_start_date: "desc" },
    });

    const availability = [];
    rows.forEach(r => {
      const activeDays = r.branch_shift_periods?.active_days || "1111111";
      const periodName = r.branch_shift_periods?.name || "Period";
      for (let dow = 0; dow < 7; dow++) {
        if (activeDays[dow] === "1") {
          availability.push({
            availability_id: `${r.id}_${dow}`,
            staff_id: r.staff_id,
            week_start_date: r.week_start_date.toISOString().slice(0, 10),
            day_of_week: dow,
            period_id: r.period_id,
            period_name: periodName,
          });
        }
      }
    });

    return res.json({ success: true, availability });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS OWNER — pool management
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/pool
async function getPool(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { status } = req.query;

    let query = supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status, bio, joined_at, approved_at")
      .eq("business_id", biz.business_id)
      .order("joined_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data: workers } = await query;

    const enriched = await Promise.all((workers || []).map(async (w) => {
      const user = await prisma.users.findUnique({
        where: { user_id: w.user_id },
        select: { full_name: true, email: true, username: true },
      });
      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills(name)")
        .eq("user_id", w.user_id);

      // Which branches they prefer
      const { data: prefs } = await supabaseAdmin
        .from("casual_branch_preferences")
        .select("branches(branch_id, name)")
        .eq("user_id", w.user_id);

      return {
        ...w,
        full_name: user?.full_name,
        email: user?.email,
        username: user?.username,
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        preferred_branches: (prefs || []).map(p => p.branches).filter(Boolean),
      };
    }));

    return res.json({ success: true, workers: enriched, join_code: biz.join_code });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// POST /api/casual/pool/:id/approve
async function approveWorker(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "approved", approved_by: req.user.user_id, approved_at: new Date().toISOString() })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id);

    if (error) throw new Error(error.message);

    const { data: cw } = await supabaseAdmin.from("casual_workers").select("user_id").eq("id", Number(req.params.id)).maybeSingle();
    if (cw?.user_id) {
      await prisma.staff.updateMany({ where: { user_id: cw.user_id, staff_type: "casual" }, data: { is_active: true } });
      await notifyUser({
        recipientId: cw.user_id,
        type: "casual_approved",
        title: "Your application was approved!",
        message: `You've been approved as a casual worker for ${biz.name}. You can now set your preferred branches.`,
        relatedEntity: "casual_worker",
        relatedId: Number(req.params.id),
      });
    }

    return res.json({ success: true, message: "Worker approved." });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// POST /api/casual/pool/:id/reject
async function rejectWorker(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { data: cw, error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "rejected" })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id)
      .select("user_id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (cw?.user_id) {
      await notifyUser({
        recipientId: cw.user_id,
        type: "casual_rejected",
        title: "Application Update",
        message: `Your application to join ${biz.name} as a casual worker was not approved.`,
        relatedEntity: "casual_worker",
        relatedId: req.params.id,
      });
    }

    return res.json({ success: true, message: "Worker rejected." });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// GET /api/casual/join-code
async function getJoinCode(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    if (!biz.join_code) {
      const code = generateJoinCode();
      await supabaseAdmin.from("businesses").update({ join_code: code }).eq("business_id", biz.business_id);
      return res.json({ success: true, join_code: code });
    }

    return res.json({ success: true, join_code: biz.join_code });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER — auto-assign casual to a shift role
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/casual/manager/auto-assign  body: { shift_id, task_id }
async function autoAssignCasual(req, res) {
  try {
    const { shift_id, task_id } = req.body;
    if (!shift_id || !task_id) {
      return res.status(400).json({ success: false, message: "shift_id and task_id are required." });
    }

    const branch = await resolveManagerBranch(req.user.user_id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    // Get shift details
    const shift = await prisma.shifts.findUnique({
      where: { shift_id: Number(shift_id) },
      select: { shift_id: true, branch_id: true, shift_date: true, start_time: true, end_time: true, period_id: true },
    });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });
    if (shift.branch_id !== branch.branch_id) return res.status(403).json({ success: false, message: "Access denied." });

    // One task = one person: reject if already assigned
    const existingAssignment = await prisma.task_assignments.findFirst({ where: { task_id: Number(task_id) } });
    const task = await prisma.shift_tasks.findUnique({ where: { task_id: Number(task_id) }, select: { title: true, start_time: true, end_time: true, skill_id: true } });
    if (existingAssignment) {
      return res.status(400).json({ success: false, message: "This task is already assigned." });
    }

    // shift_date day of week: Mon=0 … Sun=6. Prisma returns `@db.Date` columns as UTC-midnight
    // ISO strings, and shiftWeekStart below is computed in UTC — mixing that with a local-time
    // getDay() here would silently shift the computed day by one near a UTC/local timezone
    // boundary (e.g. late evening in a negative-UTC-offset server timezone), which then makes
    // casual_availability's exact (day_of_week, week_start_date) match miss every candidate.
    // getUTCDayOfWeekMondayFirst/getUTCMondayWeekStart (utils/scheduling.js) keep this UTC
    // consistently, and are unit tested directly (tests/scheduling.test.js).
    const shiftDate = new Date(shift.shift_date);
    const dayOfWeek = getUTCDayOfWeekMondayFirst(shiftDate);

    // Use the task's own time window (falls back to the shift's overall span if unset)
    const toMins = toMinutesFromTimeValue;
    const shiftStart = toMins(task?.start_time || shift.start_time);
    const shiftEnd   = toMins(task?.end_time || shift.end_time);
    const shiftDateStr = shiftDate.toISOString().slice(0, 10);

    // Casual workers from this business who've listed this branch as a preferred branch
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branch.branch_id);
    const preferredUserIds = new Set((prefs || []).map(p => p.user_id));

    const { data: approvedWorkers } = await supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status")
      .eq("business_id", branch.business_id)
      .eq("status", "approved")
      .in("user_id", preferredUserIds.size > 0 ? [...preferredUserIds] : [-1]);

    if (!approvedWorkers || approvedWorkers.length === 0) {
      return res.json({ success: false, flagged: true, reason: "No approved casual workers prefer this branch yet." });
    }

    // week_start_date for the shift's week (Mon-aligned), to match casual_availability's granularity
    const shiftWeekStart = getUTCMondayWeekStart(shiftDate);

    // Configurable allocation weights (business owner sets these in Settings — the settings UI
    // writes to this same branch_allocation_preferences table this reads, confirmed during Round
    // 6 Task 10; the business-level allocation_preferences table/endpoint still exist but nothing
    // in the reachable UI writes to them in normal operation, so there's no live divergence to
    // reconcile). Weights are on a 0-100 scale and sum to 100 by convention.
    //
    // Round 6, Task 10: rebuilt to three dimensions — skills, attendance, workload. Availability
    // is a hard gate (hard filter 1 above), not a weight, so weighting it again here would
    // double-count the same signal. Performance has no backing data anywhere in the schema and
    // was always a fixed neutral score that never changed a ranking, so it's dropped rather than
    // kept as dead weight. weight_availability and weight_performance stay as columns on both
    // allocation_preferences and branch_allocation_preferences (no schema change, no migration —
    // an old row still has 5 populated columns) but are simply never read here any more.
    const { data: branchAlloc } = await supabaseAdmin
      .from("branch_allocation_preferences")
      .select("*")
      .eq("branch_id", branch.branch_id)
      .maybeSingle();
    const wSkills = branchAlloc?.weight_skills     ?? 50;
    const wAttend = branchAlloc?.weight_attendance ?? 30;
    const wWork   = branchAlloc?.weight_workload   ?? 20;

    // Batched lookups for scoring — fetched for every approved worker up front (not just the
    // eventual winner) so the response can show a full per-candidate breakdown.
    const approvedUserIds = approvedWorkers.map(w => w.user_id);
    const [skillTagRows, userRows, laborSettingsResult] = await Promise.all([
      prisma.user_skill_tags.findMany({
        where: { user_id: { in: approvedUserIds } },
        select: { user_id: true, skill_id: true, experience_level: true },
      }),
      prisma.users.findMany({
        where: { user_id: { in: approvedUserIds } },
        select: { user_id: true, full_name: true },
      }),
      // Round 7, P1 finding T-02: fetched once for the whole candidate pool (same branch, same
      // shift, every candidate) instead of once per candidate inside checkLaborRules — see the
      // batched task_assignments query below and where laborSettings/otherAssignmentsByStaffId
      // get handed to checkLaborRules in the candidate loop.
      supabaseAdmin.from("branch_settings").select("max_work_hours_day, max_consecutive_days, allow_overtime").eq("branch_id", branch.branch_id).maybeSingle(),
    ]);
    const laborSettings = laborSettingsResult?.data || null;
    const skillTagsByUser = {};
    skillTagRows.forEach(t => {
      if (!skillTagsByUser[t.user_id]) skillTagsByUser[t.user_id] = [];
      skillTagsByUser[t.user_id].push(t);
    });
    const nameByUser = Object.fromEntries(userRows.map(u => [u.user_id, u.full_name]));

    // 0-1 sub-score: does the candidate hold the task's required skill, weighted by their
    // recorded experience level? A task with no skill_id has nothing to differentiate on, so
    // every candidate scores full marks for this dimension.
    const EXPERIENCE_LEVEL_SCORE = { junior: 0.6, intermediate: 0.8, senior: 1, expert: 1 };
    function skillsSubScore(userId) {
      if (!task?.skill_id) return 1;
      const tag = (skillTagsByUser[userId] || []).find(t => t.skill_id === task.skill_id);
      if (!tag) return 0;
      const level = (tag.experience_level || "").toLowerCase();
      return EXPERIENCE_LEVEL_SCORE[level] ?? 0.7;
    }

    // Round 6, Task 10: availability dropped out of the scoring model entirely — it's a hard
    // gate now (hard filter 1 below), and scoring *how well* someone cleared it (the old
    // availabilitySubScore, ranking a tight-fit window over "available all day") would just
    // double-count the same signal a second time. Performance is gone too: no rating/review
    // table exists anywhere in the schema to back it, and it was always a fixed neutral score
    // that never once changed a ranking — kept as a slider it would just be a lie about having
    // real signal behind it. See docs/FUTURE_WORK for both as candidates if that data ever exists.
    //
    // Attendance is now real: approved timesheets ÷ task assignments on this candidate's own
    // *past* shifts over the trailing 90 days (relative to this shift's date, not "today" — so
    // generating shifts for a future week scores attendance the same way regardless of when the
    // manager happens to click the button). A candidate with zero assignments in that window has
    // no track record to judge — scored 0.75 (deliberately not 0, which would read as "bad", and
    // not 1, which would read as "perfect": a new/rarely-used casual should neither be penalised
    // nor outrank someone with a long clean record) — clamped to [0, 1] regardless.
    const ATTENDANCE_NO_HISTORY_SUBSCORE = 0.75;

    // Batched eligibility lookups — one query per data source across all approved workers,
    // instead of the previous per-candidate round trips (staff row, availability,
    // double-booking, past-assignment count each queried once per worker in a loop). Total
    // query count here is now independent of how many casual workers are in the pool.
    const staffRowsForPool = await prisma.staff.findMany({
      where: { user_id: { in: approvedUserIds }, staff_type: "casual" },
      select: { staff_id: true, user_id: true },
    });
    const staffIdByUserId = Object.fromEntries(staffRowsForPool.map(s => [s.user_id, s.staff_id]));
    const staffIds = staffRowsForPool.map(s => s.staff_id);

    // Postgres DATE columns carry no time component, so any UTC-midnight Date for this day
    // matches regardless of exact time-of-day — this is an exact-date filter, not a range.
    const shiftDateOnly = new Date(`${shiftDateStr}T00:00:00.000Z`);
    const ninetyDaysAgo = new Date(shiftDateOnly);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

    // Round 6, Task 6: which availability source to query depends on whether this shift belongs
    // to a shift period. A branch that hasn't set up periods (or has deactivated all of them)
    // produces shifts with period_id === null, and for those the old casual_availability
    // time-coverage check keeps running completely unchanged — this mirrors the same "no periods
    // → behaves exactly as today" guarantee Task 2's generator gives, applied here to matching.
    const shiftPeriodId = shift.period_id;

    // Round 7, P1 finding T-02: bounded the same way checkLaborRules now bounds its own
    // fallback query (see taskController.js) — `maxConsec` days either side of this shift is
    // enough to determine whether the consecutive-day rule is breached, and fetching it once for
    // every candidate here (instead of once per candidate inside checkLaborRules) is what makes
    // the query count independent of the candidate pool size.
    const maxConsecForWindow = laborSettings?.max_consecutive_days || 6;
    const laborWindowStart = new Date(shiftDateOnly.getTime() - maxConsecForWindow * 86400000);
    const laborWindowEnd = new Date(shiftDateOnly.getTime() + maxConsecForWindow * 86400000);

    const [availRows, periodAvailRows, standingAvailRows, sameDayAssignments, pastAssignmentCounts, leaveRows, laborRuleAssignments] = await Promise.all([
      shiftPeriodId
        ? Promise.resolve([])
        : prisma.casual_availability.findMany({
            where: { staff_id: { in: staffIds }, day_of_week: dayOfWeek, week_start_date: shiftWeekStart },
            select: { staff_id: true, available_from: true, available_to: true },
          }),
      shiftPeriodId
        ? prisma.casual_period_availability.findMany({
            where: { staff_id: { in: staffIds }, week_start_date: shiftWeekStart },
            select: { staff_id: true, period_id: true },
          })
        : Promise.resolve([]),
      shiftPeriodId
        ? prisma.casual_standing_availability.findMany({
            where: { staff_id: { in: staffIds }, day_of_week: dayOfWeek },
            select: { staff_id: true, period_id: true },
          })
        : Promise.resolve([]),
      // Only this exact date's assignments — the previous version fetched every assignment a
      // staff member had *ever* had and filtered down to same-day in JS, an unbounded query that
      // grew without limit over the lifetime of the app.
      prisma.task_assignments.findMany({
        where: { staff_id: { in: staffIds }, status: { not: "cancelled" }, shifts: { shift_date: shiftDateOnly } },
        select: { staff_id: true, shifts: { select: { start_time: true, end_time: true } } },
      }),
      prisma.task_assignments.groupBy({
        by: ["staff_id"],
        where: { staff_id: { in: staffIds }, status: { not: "cancelled" } },
        _count: { staff_id: true },
      }),
      // Approved leave overlapping the shift date — hard exclude, same gate pattern as
      // double-booking below (Hard filter 2).
      prisma.availability.findMany({
        where: { staff_id: { in: staffIds }, status: "approved", start_date: { lte: shiftDateOnly }, end_date: { gte: shiftDateOnly } },
        select: { staff_id: true },
      }),
      prisma.task_assignments.findMany({
        where: { staff_id: { in: staffIds }, shift_id: { not: Number(shift_id) }, shifts: { shift_date: { gte: laborWindowStart, lte: laborWindowEnd } } },
        select: { staff_id: true, shifts: { select: { shift_date: true, start_time: true, end_time: true } } },
      }),
    ]);
    const otherAssignmentsByStaffId = {};
    laborRuleAssignments.forEach(a => {
      if (!otherAssignmentsByStaffId[a.staff_id]) otherAssignmentsByStaffId[a.staff_id] = [];
      otherAssignmentsByStaffId[a.staff_id].push(a);
    });

    const availByStaffId = Object.fromEntries(availRows.map(a => [a.staff_id, a]));
    const onLeaveStaffIds = new Set(leaveRows.map(l => l.staff_id));

    // Resolution order (Round 6, Task 6 spec): explicit weekly rows, if any exist for this staff
    // this week, are used ALONE — a period not among them means unavailable, it does NOT fall
    // back to the standing pattern. Only a staff member with zero explicit rows this week falls
    // back to their standing pattern for this weekday.
    const explicitPeriodsByStaffId = {}; // staff_id -> Set(period_id) — only populated when >=1 row exists
    periodAvailRows.forEach(r => {
      if (!explicitPeriodsByStaffId[r.staff_id]) explicitPeriodsByStaffId[r.staff_id] = new Set();
      explicitPeriodsByStaffId[r.staff_id].add(r.period_id);
    });
    const standingPeriodsByStaffId = {}; // staff_id -> Set(period_id) for this exact weekday
    standingAvailRows.forEach(r => {
      if (!standingPeriodsByStaffId[r.staff_id]) standingPeriodsByStaffId[r.staff_id] = new Set();
      standingPeriodsByStaffId[r.staff_id].add(r.period_id);
    });
    function isAvailableForPeriod(staffId) {
      const explicit = explicitPeriodsByStaffId[staffId];
      if (explicit) return explicit.has(shiftPeriodId);
      const standing = standingPeriodsByStaffId[staffId];
      return standing ? standing.has(shiftPeriodId) : false;
    }

    const sameDayAssignmentsByStaffId = {};
    sameDayAssignments.forEach(a => {
      if (!sameDayAssignmentsByStaffId[a.staff_id]) sameDayAssignmentsByStaffId[a.staff_id] = [];
      sameDayAssignmentsByStaffId[a.staff_id].push(a.shifts);
    });
    const pastAssignmentsByStaffId = Object.fromEntries(pastAssignmentCounts.map(r => [r.staff_id, r._count.staff_id]));

    // Round 6, Task 10: real attendance. "Past" here means the shift date is strictly before
    // *this* shift's date (not today's date), so scoring stays reproducible regardless of when a
    // manager happens to run generation/auto-assign. Two-step because which timesheets count
    // depends on which shifts turned up in the first query.
    const pastAssignments90d = await prisma.task_assignments.findMany({
      where: { staff_id: { in: staffIds }, status: { not: "cancelled" }, shifts: { shift_date: { gte: ninetyDaysAgo, lt: shiftDateOnly } } },
      select: { staff_id: true, shift_id: true },
    });
    const relevantShiftIds = [...new Set(pastAssignments90d.map(a => a.shift_id))];
    const approvedTimesheets90d = relevantShiftIds.length > 0
      ? await prisma.timesheets.findMany({
          where: { staff_id: { in: staffIds }, shift_id: { in: relevantShiftIds }, status: "approved" },
          select: { staff_id: true, shift_id: true },
        })
      : [];
    const approvedShiftKeySet = new Set(approvedTimesheets90d.map(t => `${t.staff_id}:${t.shift_id}`));
    const assignmentCountByStaffId = {};
    const approvedCountByStaffId = {};
    pastAssignments90d.forEach(a => {
      assignmentCountByStaffId[a.staff_id] = (assignmentCountByStaffId[a.staff_id] || 0) + 1;
      if (approvedShiftKeySet.has(`${a.staff_id}:${a.shift_id}`)) {
        approvedCountByStaffId[a.staff_id] = (approvedCountByStaffId[a.staff_id] || 0) + 1;
      }
    });
    function attendanceSubScore(staffId) {
      const total = assignmentCountByStaffId[staffId] || 0;
      if (total === 0) return ATTENDANCE_NO_HISTORY_SUBSCORE;
      const approved = approvedCountByStaffId[staffId] || 0;
      return Math.min(1, Math.max(0, approved / total));
    }

    const candidates = [];
    const failReasons = { unavailable: 0, double_booked: 0, labor_rules: 0, on_leave: 0 };

    for (const cw of approvedWorkers) {
      const staffId = staffIdByUserId[cw.user_id];
      if (!staffId) { failReasons.unavailable++; continue; }

      // Hard filter 0: approved leave covering this shift's date. Checked before availability/
      // scoring — a candidate on approved leave is excluded outright, not merely scored lower.
      if (onLeaveStaffIds.has(staffId)) { failReasons.on_leave++; continue; }

      // Hard filter 1 (gate, not a score — Round 6, Task 10): availability for this shift's day.
      // Period-based (binary) when the shift belongs to a shift period; otherwise the original
      // time-coverage check, unchanged. Passing this filter is all that matters now; how tightly
      // a candidate's window fit used to feed the score (availabilitySubScore) but that dimension
      // is gone from the model, so nothing downstream reads *how* someone passed, only that they did.
      if (shiftPeriodId) {
        if (!isAvailableForPeriod(staffId)) { failReasons.unavailable++; continue; }
      } else {
        const avail = availByStaffId[staffId];
        if (!avail) { failReasons.unavailable++; continue; }
        const availStart = toMins(avail.available_from);
        const availEnd   = toMins(avail.available_to);
        if (availStart > shiftStart || availEnd < shiftEnd) { failReasons.unavailable++; continue; }
      }

      // Hard filter 2: not double-booked on same date with overlapping times
      const doubleBooked = (sameDayAssignmentsByStaffId[staffId] || []).some(s =>
        doTimeRangesOverlap(toMins(s.start_time), toMins(s.end_time), shiftStart, shiftEnd)
      );
      if (doubleBooked) { failReasons.double_booked++; continue; }

      // Round 3, Task 5: branch labor rules (max daily hours, max consecutive working days) are
      // now a SOFT signal, not a hard filter — the same check assignStaff uses for manual
      // assignment (checkLaborRules is shared, unmodified rule logic from taskController.js), but
      // a breach here only ranks the candidate lower via laborPenalty below, applied after
      // weighted scoring. failReasons.labor_rules is kept for the score_breakdown / empty-result
      // messaging below, now meaning "would breach" rather than "excluded". Round 7, P1 finding
      // T-02: shift/settings/otherAssignments are prefetched once above for the whole candidate
      // pool (see laborSettings/otherAssignmentsByStaffId), so this call does no DB round trip.
      const laborWarning = await checkLaborRules(staffId, Number(shift_id), branch.branch_id, {
        shift, settings: laborSettings, otherAssignmentsByStaffId,
      });
      if (laborWarning) failReasons.labor_rules++;

      // Passed the remaining hard filters — gather the raw signal needed for weighted scoring.
      const pastAssignments = pastAssignmentsByStaffId[staffId] || 0;

      candidates.push({
        cw,
        staffId,
        pastAssignments,
        laborWarning,
        subScores: {
          skills: skillsSubScore(cw.user_id),
          attendance: attendanceSubScore(staffId),
        },
      });
    }

    if (candidates.length === 0) {
      // labor_rules is deliberately not a possible cause here any more (Task 5: it's a soft
      // score penalty below, not a filter) — any candidate who only breaches labor rules is
      // still in `candidates`, so reaching zero can only mean unavailable/double_booked.
      const parts = [];
      if (failReasons.on_leave > 0) parts.push(`${failReasons.on_leave} on approved leave`);
      if (failReasons.unavailable > 0) parts.push(`${failReasons.unavailable} unavailable on ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][dayOfWeek]}`);
      if (failReasons.double_booked > 0) parts.push(`${failReasons.double_booked} already booked at this time`);
      return res.json({
        success: false,
        flagged: true,
        reason: `No eligible casual workers — ${parts.join(", ")}.`,
      });
    }

    // Workload is normalised relative to this candidate set (not a fixed scale), so it can only
    // be computed once every surviving candidate's past-assignment count is known.
    const maxPastAssignments = Math.max(...candidates.map(c => c.pastAssignments), 0);
    // Round 3, Task 5: a labor-rule breach costs 30% of the otherwise-earned score rather than
    // excluding the candidate outright — enough to consistently rank a clean candidate above a
    // breaching one when both are viable, but a breaching candidate can still win when nobody
    // else fits (matching allow_overtime's own meaning: the branch already expects some breaches
    // to happen sometimes).
    const LABOR_WARNING_PENALTY = 0.7;
    candidates.forEach(c => {
      c.subScores.workload = maxPastAssignments === 0 ? 1 : 1 - c.pastAssignments / maxPastAssignments;
      c.score = computeWeightedScore(c.subScores, {
        skills: wSkills, attendance: wAttend, workload: wWork,
      });
      if (c.laborWarning) c.score *= LABOR_WARNING_PENALTY;
    });

    // Pick top scorer
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];

    // Create assignment
    const assignment = await prisma.task_assignments.create({
      data: {
        shift_id: Number(shift_id),
        task_id: Number(task_id),
        staff_id: winner.staffId,
        status: "assigned",
        acknowledged: false,
      },
    });

    // Notify the worker
    const user = await prisma.users.findUnique({ where: { user_id: winner.cw.user_id }, select: { full_name: true } });
    await notifyUser({
      recipientId: winner.cw.user_id,
      type: "casual_assigned",
      title: "You've been assigned to a shift!",
      message: `You've been assigned to ${task?.title || "a task"} on ${shiftDateStr} at ${branch.name}. Please check your schedule.`,
      relatedEntity: "shift",
      relatedId: Number(shift_id),
    });

    return res.json({
      success: true,
      assigned: {
        assignment_id: assignment.assignment_id,
        full_name: user?.full_name,
        user_id: winner.cw.user_id,
        past_assignments: winner.pastAssignments,
        score: Math.round(winner.score * 10) / 10,
        labor_warning: winner.laborWarning || null,
      },
      // Explainable breakdown for every candidate who passed the hard filters (already sorted
      // best-first), so a demo can show why the winner beat the runners-up.
      score_breakdown: {
        weights_applied: { skills: wSkills, attendance: wAttend, workload: wWork },
        candidates: candidates.map(c => ({
          user_id: c.cw.user_id,
          full_name: nameByUser[c.cw.user_id] || null,
          score: Math.round(c.score * 10) / 10,
          sub_scores: {
            skills: Math.round(c.subScores.skills * 100) / 100,
            attendance: Math.round(c.subScores.attendance * 100) / 100,
            workload: Math.round(c.subScores.workload * 100) / 100,
          },
          // Round 3, Task 5: the labor-rule outcome for this candidate — null when clean, the
          // human-readable reason from checkLaborRules when it would breach a limit. Applied as
          // a 30% score penalty above, not an exclusion.
          labor_warning: c.laborWarning || null,
        })),
      },
    });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

// POST /api/casual/join-code/regenerate
async function regenerateJoinCode(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const code = generateJoinCode();
    const { error } = await supabaseAdmin.from("businesses").update({ join_code: code }).eq("business_id", biz.business_id);
    if (error) throw new Error(error.message);

    return res.json({ success: true, join_code: code });
  } catch (err) {
    return sendServerError(res, err, req);
  }
}

module.exports = {
  registerCasualWorker,
  getCasualWorkerStatus,
  getMyBranches,
  getPreferences,
  setPreferences,
  getMyAvailability,
  setMyAvailability,
  submitWeeklyAvailability,
  getPeriodAvailability,
  getPeriodAvailabilityHistory,
  setPeriodAvailability,
  getStandingAvailability,
  setStandingAvailability,
  setWeekAsStandingPattern,
  getManagerPool,
  getManagerPeriodAvailability,
  autoAssignCasual,
  getPool,
  approveWorker,
  rejectWorker,
  getJoinCode,
  regenerateJoinCode,
};
