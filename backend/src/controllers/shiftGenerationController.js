const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const logger = require("../config/logger");

const sendServerError = require("../utils/sendServerError");
const { toMinutes } = require("../utils/hoursMetrics");
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

  // Round 6, Task 2: active periods for this branch, earliest sort_order first. Empty for the
  // ~unlimited number of branches that haven't defined any — that's the "one shift per operating
  // day" path below, completely untouched from pre-Round-6 behaviour. The backfill script gives
  // every EXISTING branch exactly one "Full Day" period, so in practice that path is now only hit
  // by a branch that has actively deleted/deactivated all of its periods.
  const activePeriods = await prisma.branch_shift_periods.findMany({
    where: { branch_id: branchId, is_active: true },
    orderBy: { sort_order: "asc" },
  });

  // Round 6, Task 4 — was a `shifts.findFirst` per day inside the loop below: one DB round-trip
  // per date in range even when almost every date is a no-op "already generated" skip. Over the
  // 56-day rolling horizon that's up to 57 sequential network round-trips (~390ms each observed
  // against this Supabase region) — 20+ seconds for a call that creates nothing, which is exactly
  // the kind of "did the button even work?" delay Task 4a exists to fix. One query for the whole
  // range, checked in-memory in the loop, is behaviourally identical — same skip reasons, same
  // idempotency — just not re-fetched 57 times.
  const existingShiftRows = await prisma.shifts.findMany({
    where: { branch_id: branchId, shift_date: { gte: new Date(`${startDateStr}T00:00:00Z`), lte: new Date(`${endDateStr}T00:00:00Z`) } },
    select: { shift_id: true, source: true, shift_date: true, period_id: true },
  });
  // Kept exactly as it was pre-Round-6 — the no-periods path below reads only this, unchanged.
  const existingByDate = new Map(existingShiftRows.map(s => [toDateStr(s.shift_date), s]));
  // Round 6, Task 2: per date+period, so re-running generation can tell "Morning already
  // generated for this date" apart from "Evening already generated for this date" instead of one
  // shift silently blocking the other. 'null' bucket = the fallback shift for templates with no
  // period assigned.
  const existingByDatePeriod = new Map(existingShiftRows.map(s => [`${toDateStr(s.shift_date)}:${s.period_id ?? "null"}`, s]));

  const created = [];
  const skipped = [];

  // A template's required_workers is a headcount, but shift_tasks/task_assignments is a strict
  // 1-task-1-person model everywhere else in the app (see taskController.js assignStaff's "One
  // task = one person" check). Rather than changing that model, required_workers > 1 is expanded
  // into that many identical task rows, each independently assignable — headcount 3 on "Cashier"
  // becomes three separate "Cashier" tasks a manager (or casual allocation) fills one at a time.
  function expandTaskRows(shiftId, dayTemplates, periodId) {
    const rows = [];
    for (const t of dayTemplates) {
      const copies = Math.max(1, t.required_workers || 1);
      for (let i = 0; i < copies; i++) {
        rows.push({
          shift_id: shiftId,
          title: t.title,
          skill_id: t.skill_id,
          start_time: t.start_time,
          end_time: t.end_time,
          status: "open",
          period_id: periodId,
        });
      }
    }
    return rows;
  }

  // Task 7: place contracted regular staff onto today's open tasks. Simple placement, not
  // skill-matched scoring — that precision is reserved for casual allocation per the brief's
  // own distinction ("regular staff are populated, casual workers are allocated"). Each eligible
  // staff member (contracted this weekday, no approved off-day covering this date, not already
  // placed elsewhere today — see placedToday below) fills one open task in whatever order the
  // tasks were generated; leftover tasks (more tasks than eligible staff) are exactly what's left
  // for casual allocation to target.
  async function populateRegularStaff(shiftId, createdTasks, todaysEligibleStaff, placedToday) {
    const openTasks = [...createdTasks];
    let placedCount = 0;
    for (const s of todaysEligibleStaff) {
      if (placedToday.has(s.staff_id)) continue; // Round 6: see the "two periods in one day" decision below
      const task = openTasks.shift();
      if (!task) break; // more contracted staff than open tasks today — nothing left to place them on
      await prisma.task_assignments.create({
        data: { task_id: task.task_id, shift_id: shiftId, staff_id: s.staff_id, status: "assigned" },
      });
      await prisma.shift_tasks.update({ where: { task_id: task.task_id }, data: { status: "assigned" } });
      placedToday.add(s.staff_id);
      placedCount++;
    }
    return placedCount;
  }

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

    const todaysEligibleStaff = eligibleRegularStaff.filter(s =>
      s.default_work_days[dow] === "1" && !offDaySet.has(`${s.staff_id}:${dateStr}`)
    );

    if (activePeriods.length === 0) {
      // ── Unchanged from pre-Round-6: one shift per operating day, covering branch operating
      // hours, containing every one of today's templates. This is the regression guarantee — a
      // branch with no periods (or, before the backfill runs, every existing branch) must behave
      // exactly as it did before this round. ──
      const existing = existingByDate.get(dateStr);
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

      const taskRows = expandTaskRows(shift.shift_id, dayTemplates, null);
      const createdTasks = taskRows.length > 0 ? await prisma.shift_tasks.createManyAndReturn({ data: taskRows }) : [];

      const placedToday = new Set();
      const placedCount = await populateRegularStaff(shift.shift_id, createdTasks, todaysEligibleStaff, placedToday);
      if (placedCount > 0) autoPopulated.push({ date: dateStr, assigned_count: placedCount });

      created.push(dateStr);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }

    // ── Branch has periods: one shift per period active today, plus one fallback shift for any
    // templates with no period assigned. ──
    const templatesByPeriod = new Map(); // period_id (or "null") -> templates[]
    for (const t of dayTemplates) {
      const key = t.period_id ?? "null";
      if (!templatesByPeriod.has(key)) templatesByPeriod.set(key, []);
      templatesByPeriod.get(key).push(t);
    }

    const placedToday = new Set(); // Round 6 decision: a regular staff member is placed into AT
    // MOST ONE shift per day, even if their contracted weekday has two active periods (e.g.
    // Morning + Evening). Placing them in both would silently double-book one person across two
    // separate crews on the same day, which the round's own brief calls "probably wrong" — this
    // makes that call explicit and consistent: first period (by sort_order) with an open task
    // wins, shared across every period-shift created for this date via this one Set.
    let dayPlacedCount = 0;

    const periodsToday = activePeriods.filter(p => p.active_days?.[dow] === "1");
    for (const period of periodsToday) {
      const periodTemplates = templatesByPeriod.get(period.period_id) || [];
      if (periodTemplates.length === 0) continue; // nothing assigned to this period today — no empty shift, same "don't generate a pointless shift" rule as the no-templates day-level skip above

      const existing = existingByDatePeriod.get(`${dateStr}:${period.period_id}`);
      if (existing) {
        skipped.push({ date: dateStr, reason: `"${period.name}" ${existing.source === "generated" ? "already generated" : "a manual shift already exists for this period"}` });
        continue;
      }

      // Overnight periods (end <= start, e.g. 16:00-00:00): the rest of this schema doesn't
      // support a shift crossing midnight (shift_date is a single DATE, start/end are TIME-only
      // columns with no day component) — same constraint shift creation elsewhere already
      // enforces. Rather than inventing partial next-day support here, the honest behaviour is:
      // the generated shift ends at 23:59:59 on the period's own day. A period like "Evening
      // 16:00-00:00" therefore generates a 16:00-23:59:59 shift, not a true midnight crossing.
      const startMin = toMinutes(period.start_time);
      const endMin = toMinutes(period.end_time);
      const isOvernight = startMin !== null && endMin !== null && endMin <= startMin;
      const periodEndTime = isOvernight ? new Date("1970-01-01T23:59:59Z") : period.end_time;

      const shift = await prisma.shifts.create({
        data: {
          branch_id: branchId,
          shift_date: new Date(`${dateStr}T00:00:00Z`),
          title: period.name,
          start_time: period.start_time,
          end_time: periodEndTime,
          status: "draft",
          shift_type: "regular",
          source: "generated",
          period_id: period.period_id,
        },
      });

      const taskRows = expandTaskRows(shift.shift_id, periodTemplates, period.period_id);
      const createdTasks = taskRows.length > 0 ? await prisma.shift_tasks.createManyAndReturn({ data: taskRows }) : [];

      const placedCount = await populateRegularStaff(shift.shift_id, createdTasks, todaysEligibleStaff, placedToday);
      dayPlacedCount += placedCount;

      created.push(`${dateStr} (${period.name})`);
    }

    // Templates with no period_id, on a branch that DOES have periods: one additional shift
    // covering the branch's own operating hours, same as the no-periods path's shift shape —
    // reported explicitly via created/skipped, never silently dropped.
    const nullTemplates = templatesByPeriod.get("null") || [];
    if (nullTemplates.length > 0) {
      const existing = existingByDatePeriod.get(`${dateStr}:null`);
      if (existing) {
        skipped.push({ date: dateStr, reason: `unassigned tasks: ${existing.source === "generated" ? "already generated" : "a manual shift already exists"}` });
      } else {
        const shift = await prisma.shifts.create({
          data: {
            branch_id: branchId,
            shift_date: new Date(`${dateStr}T00:00:00Z`),
            start_time: branch?.open_time || new Date("1970-01-01T09:00:00Z"),
            end_time: branch?.close_time || new Date("1970-01-01T18:00:00Z"),
            status: "draft",
            shift_type: "regular",
            source: "generated",
            period_id: null,
          },
        });
        const taskRows = expandTaskRows(shift.shift_id, nullTemplates, null);
        const createdTasks = taskRows.length > 0 ? await prisma.shift_tasks.createManyAndReturn({ data: taskRows }) : [];
        const placedCount = await populateRegularStaff(shift.shift_id, createdTasks, todaysEligibleStaff, placedToday);
        dayPlacedCount += placedCount;
        created.push(`${dateStr} (unassigned tasks)`);
      }
    }

    if (dayPlacedCount > 0) autoPopulated.push({ date: dateStr, assigned_count: dayPlacedCount });

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
