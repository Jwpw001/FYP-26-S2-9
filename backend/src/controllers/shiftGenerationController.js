const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const logger = require("../config/logger");

const sendServerError = require("../utils/sendServerError");
// Mon=0…Sun=6 — same convention as branch_settings.operating_days, casual_availability.day_of_week,
// and branch_task_templates.day_of_week (verified against shiftController.js's existing
// (getUTCDay()+6)%7 conversion, not assumed).
function dowMonday0(date) {
  return (date.getUTCDay() + 6) % 7;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

// The rolling horizon the cron job keeps generated: 8 weeks out. Long enough that a manager
// planning a month ahead always finds shifts already there, short enough that a template edit
// today doesn't need to "catch up" across months of future shifts it never touched.
const ROLLING_HORIZON_DAYS = 56;

// Core generation routine — for one branch, over [startDateStr, endDateStr] inclusive (both
// "YYYY-MM-DD"), creates one shift per operating day and copies that day's active task
// templates into shift_tasks.
//
// Copy, never reference: shift_tasks rows are independent copies of the template row at the
// moment of generation. Editing a template afterwards does not retroactively change any shift
// already generated from it — this is deliberate, not an oversight, so a manager can safely
// tweak next month's template without silently rewriting a roster staff have already seen and
// possibly started swapping/covering.
//
// Idempotent: a date that already has a shift (generated or manual) is skipped, never duplicated
// or modified. Every skip is reported with a reason so a manager can see why a date has no
// generated shift instead of silently wondering.
async function generateShiftsForBranch(branchId, startDateStr, endDateStr) {
  const [branchSettings, branch, templates, regularStaff] = await Promise.all([
    prisma.branch_settings.findUnique({ where: { branch_id: branchId } }),
    prisma.branches.findUnique({ where: { branch_id: branchId }, select: { open_time: true, close_time: true } }),
    prisma.branch_task_templates.findMany({ where: { branch_id: branchId, is_active: true }, orderBy: [{ day_of_week: "asc" }, { sort_order: "asc" }] }),
    // Round 3, Task 7: regular staff are POPULATED (placed on their contracted days), not
    // ALLOCATED like casual workers (matched/scored) — see the round's brief. staff.default_work_days
    // is the existing contracted-days field; no new column.
    prisma.staff.findMany({ where: { branch_id: branchId, staff_type: "regular", is_active: true }, select: { staff_id: true, default_work_days: true } }),
  ]);

  const staffMissingWorkDays = regularStaff.filter(s => !s.default_work_days).map(s => s.staff_id);
  const eligibleRegularStaff = regularStaff.filter(s => s.default_work_days);

  // Approved off-day requests for these staff anywhere in the generation range, so each day's
  // pass can just check a Set instead of a query per staff per day.
  const offDayRows = eligibleRegularStaff.length > 0
    ? await prisma.off_day_requests.findMany({
        where: {
          staff_id: { in: eligibleRegularStaff.map(s => s.staff_id) },
          status: "approved",
          requested_date: { gte: new Date(`${startDateStr}T00:00:00Z`), lte: new Date(`${endDateStr}T00:00:00Z`) },
        },
        select: { staff_id: true, requested_date: true },
      })
    : [];
  const offDaySet = new Set(offDayRows.map(r => `${r.staff_id}:${toDateStr(r.requested_date)}`));
  const autoPopulated = []; // { date, assigned_count }
  const dataGaps = staffMissingWorkDays.length > 0 ? { staff_ids: staffMissingWorkDays } : null;

  const operatingDays = branchSettings?.operating_days || "1111100";
  // holidays entries are { date: "YYYY-MM-DD", name, enabled, reason? } — see
  // frontend/src/data/sgHolidays.js for the canonical shape and business-owner/manager
  // Settings.jsx for where enabled is toggled. This array covers BOTH the legacy per-holiday
  // toggle list and Task 3's ad-hoc closures (markDateClosed) — both are "this branch is closed
  // on this date" when enabled !== false, regardless of which put the entry there.
  const rawHolidays = Array.isArray(branchSettings?.holidays) ? branchSettings.holidays : [];
  const closedDates = new Set(rawHolidays.filter(h => h?.enabled !== false).map(h => h?.date));

  // Task 3: independently of the above, skip any date the global public_holidays reference
  // table knows about — UNLESS this branch has opted to work through public holidays. This
  // means a branch doesn't need every holiday pre-added to `holidays` to get sensible default
  // behaviour; treat_public_holidays_as_working is nullable (see schema comment) so `!== true`
  // (not `=== false`) treats an unset value the same as its column default of false.
  if (branchSettings?.treat_public_holidays_as_working !== true) {
    const publicHolidays = await prisma.public_holidays.findMany({
      where: { country_code: "SG", holiday_date: { gte: new Date(`${startDateStr}T00:00:00Z`), lte: new Date(`${endDateStr}T00:00:00Z`) } },
      select: { holiday_date: true },
    });
    for (const h of publicHolidays) closedDates.add(toDateStr(h.holiday_date));
  }

  const templatesByDow = {};
  for (const t of templates) {
    (templatesByDow[t.day_of_week] ??= []).push(t);
  }

  const created = [];
  const skipped = [];

  const cursor = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  while (cursor <= end) {
    const dateStr = toDateStr(cursor);
    const dow = dowMonday0(cursor);

    if (operatingDays[dow] === "0") {
      skipped.push({ date: dateStr, reason: "non-operating day" });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }
    if (closedDates.has(dateStr)) {
      skipped.push({ date: dateStr, reason: "marked closed / public holiday" });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }
    const dayTemplates = templatesByDow[dow] || [];
    if (dayTemplates.length === 0) {
      skipped.push({ date: dateStr, reason: "no task templates set for this weekday" });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }

    // Never destroy manual work: if ANY shift already exists for this branch+date — generated
    // or manual — leave it alone entirely rather than trying to merge template changes into it.
    const existing = await prisma.shifts.findFirst({
      where: { branch_id: branchId, shift_date: new Date(`${dateStr}T00:00:00Z`) },
      select: { shift_id: true, source: true },
    });
    if (existing) {
      skipped.push({ date: dateStr, reason: existing.source === "generated" ? "already generated" : "a manual shift already exists on this date" });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }

    const shift = await prisma.shifts.create({
      data: {
        branch_id: branchId,
        shift_date: new Date(`${dateStr}T00:00:00Z`),
        start_time: branch?.open_time || new Date("1970-01-01T09:00:00Z"),
        end_time: branch?.close_time || new Date("1970-01-01T18:00:00Z"),
        status: "draft",
        shift_type: "regular",
        source: "generated",
      },
    });

    // A template's required_workers is a headcount, but shift_tasks/task_assignments is a strict
    // 1-task-1-person model everywhere else in the app (see taskController.js assignStaff's "One
    // task = one person" check). Rather than changing that model, required_workers > 1 is expanded
    // into that many identical task rows, each independently assignable — headcount 3 on "Cashier"
    // becomes three separate "Cashier" tasks a manager (or casual allocation) fills one at a time.
    const taskRows = [];
    for (const t of dayTemplates) {
      const copies = Math.max(1, t.required_workers || 1);
      for (let i = 0; i < copies; i++) {
        taskRows.push({
          shift_id: shift.shift_id,
          title: t.title,
          skill_id: t.skill_id,
          start_time: t.start_time,
          end_time: t.end_time,
          status: "open",
        });
      }
    }
    let createdTasks = [];
    if (taskRows.length > 0) {
      createdTasks = await prisma.shift_tasks.createManyAndReturn({ data: taskRows });
    }

    // Task 7: place contracted regular staff onto today's open tasks. Simple placement, not
    // skill-matched scoring — that precision is reserved for casual allocation per the brief's
    // own distinction ("regular staff are populated, casual workers are allocated"). Each
    // eligible staff member (contracted this weekday, no approved off-day covering this date)
    // fills one open task in whatever order the tasks were generated; leftover tasks (more tasks
    // than eligible staff) are exactly what's left for casual allocation to target.
    const todaysEligibleStaff = eligibleRegularStaff.filter(s =>
      s.default_work_days[dow] === "1" && !offDaySet.has(`${s.staff_id}:${dateStr}`)
    );
    let openTasks = [...createdTasks];
    let placedCount = 0;
    for (const s of todaysEligibleStaff) {
      const task = openTasks.shift();
      if (!task) break; // more contracted staff than open tasks today — nothing left to place them on
      await prisma.task_assignments.create({
        data: { task_id: task.task_id, shift_id: shift.shift_id, staff_id: s.staff_id, status: "assigned" },
      });
      await prisma.shift_tasks.update({ where: { task_id: task.task_id }, data: { status: "assigned" } });
      placedCount++;
    }
    if (placedCount > 0) autoPopulated.push({ date: dateStr, assigned_count: placedCount });

    created.push(dateStr);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { created, skipped, autoPopulated, dataGaps };
}

// POST /api/shifts/generate  body: { start_date?, end_date? } (both "YYYY-MM-DD")
// Defaults to today through the rolling horizon if omitted, so a manager can just hit the
// button without picking dates for the common case.
const generateShifts = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found." });

    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setUTCDate(defaultEnd.getUTCDate() + ROLLING_HORIZON_DAYS);

    const start_date = req.body?.start_date || toDateStr(today);
    const end_date = req.body?.end_date || toDateStr(defaultEnd);

    if (new Date(`${end_date}T00:00:00Z`) < new Date(`${start_date}T00:00:00Z`)) {
      return res.status(400).json({ success: false, message: "end_date must be on or after start_date." });
    }

    const { created, skipped, autoPopulated, dataGaps } = await generateShiftsForBranch(branchId, start_date, end_date);

    // Task 7: surface the "missing default_work_days" data-completeness prompt with names, not
    // just ids, so it's actually actionable for the manager reading the response — never guessed
    // a default for these staff, just skipped them (see generateShiftsForBranch's own comment).
    let dataGapStaff = [];
    if (dataGaps?.staff_ids?.length > 0) {
      const rows = await prisma.staff.findMany({
        where: { staff_id: { in: dataGaps.staff_ids } },
        select: { staff_id: true, users: { select: { full_name: true } } },
      });
      dataGapStaff = rows.map(r => ({ staff_id: r.staff_id, full_name: r.users?.full_name || null }));
    }

    return res.json({
      success: true,
      created_count: created.length,
      created_dates: created,
      skipped,
      auto_populated: autoPopulated,
      auto_populated_count: autoPopulated.reduce((sum, a) => sum + a.assigned_count, 0),
      data_gap_staff: dataGapStaff,
    });
  } catch (error) {
    return sendServerError(res, error, req);
  }
};

module.exports = { generateShifts, generateShiftsForBranch, ROLLING_HORIZON_DAYS };
