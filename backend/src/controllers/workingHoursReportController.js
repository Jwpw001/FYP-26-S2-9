const prisma = require("../config/prisma");
const { verifyBranchAccess } = require("./businessOwnerController");
const { computeHoursMetrics, toMinutes } = require("../utils/hoursMetrics");

const sendServerError = require("../utils/sendServerError");
function toDateStr(d) {
  if (!d) return null;
  const s = d instanceof Date ? d.toISOString() : String(d);
  return s.slice(0, 10);
}

// Longest run of consecutive calendar days within a set of "YYYY-MM-DD" date strings.
function longestConsecutiveRun(dateStrs) {
  if (dateStrs.length === 0) return 0;
  const sorted = [...new Set(dateStrs)].sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${sorted[i]}T00:00:00Z`).getTime();
    if (cur - prev === 86400000) { run++; longest = Math.max(longest, run); }
    else run = 1;
  }
  return longest;
}

// GET /api/reports/working-hours?branch_id=&start_date=&end_date=
// Manager/business_owner/system_admin — Round 3, Task 6. Per staff member (regular AND casual):
// rostered hours, worked/additional/overtime hours from APPROVED timesheets only, days worked,
// longest consecutive run, pending-submission count, and advisory labor-rule warnings — computed
// directly from the final roster (see Task 5's commit notes for why this is recomputed rather
// than read back from persisted per-assignment warnings: many assignments, e.g. Task 7's
// regular-staff auto-population, never go through assignStaff/checkLaborRules at all, so that
// would be systematically incomplete).
async function computeWorkingHoursReport(branchId, startDateStr, endDateStr) {
  const [branchSettings, branch] = await Promise.all([
    prisma.branch_settings.findUnique({ where: { branch_id: branchId } }),
    prisma.branches.findUnique({ where: { branch_id: branchId }, select: { open_time: true, close_time: true } }),
  ]);
  const maxHoursDay = branchSettings?.max_work_hours_day ?? 12;
  const maxConsecDays = branchSettings?.max_consecutive_days ?? 6;
  const allowOvertime = branchSettings?.allow_overtime ?? false;

  const startDate = new Date(`${startDateStr}T00:00:00Z`);
  const endDate = new Date(`${endDateStr}T23:59:59Z`);

  // Rostered side: every assignment for a shift at this branch in range, regular or casual staff
  // alike — task_assignments is the single source of truth for "who's on the roster" either way.
  const assignments = await prisma.task_assignments.findMany({
    where: { staff_id: { not: null }, shifts: { branch_id: branchId, shift_date: { gte: startDate, lte: endDate } } },
    include: {
      shift_tasks: { select: { start_time: true, end_time: true } },
      shifts: { select: { shift_id: true, shift_date: true, start_time: true, end_time: true } },
      staff: { select: { staff_id: true, staff_type: true, user_id: true, users: { select: { full_name: true } } } },
    },
  });

  const shiftIdsInRange = [...new Set(assignments.map(a => a.shifts?.shift_id).filter(Boolean))];

  // Worked side: approved + pending timesheets tied to one of this branch's shifts in range.
  // hours_worked/start_time/end_time are read as-is — computeHoursMetrics handles legacy
  // (hours_worked-only) rows the same way it did at submission time.
  const timesheets = shiftIdsInRange.length > 0
    ? await prisma.timesheets.findMany({
        where: { shift_id: { in: shiftIdsInRange }, log_date: { gte: startDate, lte: endDate } },
        select: { staff_id: true, log_date: true, hours_worked: true, start_time: true, end_time: true, status: true, shift_id: true },
      })
    : [];

  const byStaff = new Map();
  function getStaff(staffId, staffType, userId, fullName) {
    if (!byStaff.has(staffId)) {
      byStaff.set(staffId, {
        staff_id: staffId, staff_type: staffType, user_id: userId, full_name: fullName,
        rostered_hours: 0, worked_hours: 0, additional_hours: 0, overtime_hours: 0,
        hours_unknown_count: 0, days_worked: new Set(), pending_count: 0,
        dailyWorked: new Map(), // log_date -> summed worked hours, for the max-hours/day warning
      });
    }
    return byStaff.get(staffId);
  }

  for (const a of assignments) {
    if (!a.staff) continue;
    const row = getStaff(a.staff.staff_id, a.staff.staff_type, a.staff.user_id, a.staff.users?.full_name || null);
    const start = a.shift_tasks?.start_time || a.shifts?.start_time;
    const end = a.shift_tasks?.end_time || a.shifts?.end_time;
    const sMin = toMinutes(start), eMin = toMinutes(end);
    if (sMin !== null && eMin !== null && eMin > sMin) row.rostered_hours += (eMin - sMin) / 60;
  }

  for (const ts of timesheets) {
    const staffId = ts.staff_id;
    if (!byStaff.has(staffId)) continue; // shouldn't happen (every timesheet ties to an assignment's staff), but don't crash if data is inconsistent
    const row = byStaff.get(staffId);
    if (ts.status === "pending") { row.pending_count++; continue; }
    if (ts.status !== "approved") continue; // rejected — not counted anywhere, per the task's own instruction

    // "Rostered" for additional-hours purposes is this specific shift's task/shift window —
    // re-derive from the matching assignment rather than the branch-wide rostered_hours total.
    const matchingAssignment = assignments.find(a => a.staff?.staff_id === staffId && a.shifts?.shift_id === ts.shift_id);
    const rosteredStart = matchingAssignment?.shift_tasks?.start_time || matchingAssignment?.shifts?.start_time;
    const rosteredEnd = matchingAssignment?.shift_tasks?.end_time || matchingAssignment?.shifts?.end_time;

    const metrics = computeHoursMetrics({
      rosteredStart, rosteredEnd,
      actualStart: ts.start_time, actualEnd: ts.end_time,
      branchOpenTime: branch?.open_time, branchCloseTime: branch?.close_time,
      hoursWorkedFallback: ts.hours_worked,
    });

    if (metrics.workedHours !== null) row.worked_hours += metrics.workedHours;
    if (metrics.additionalHours !== null) row.additional_hours += metrics.additionalHours;
    if (metrics.overtimeHours !== null) row.overtime_hours += metrics.overtimeHours;
    if (metrics.hoursUnknown) row.hours_unknown_count++;

    const dateStr = toDateStr(ts.log_date);
    row.days_worked.add(dateStr);
    row.dailyWorked.set(dateStr, (row.dailyWorked.get(dateStr) || 0) + (metrics.workedHours || 0));
  }

  const rows = [...byStaff.values()].map(r => {
    const daysWorkedArr = [...r.days_worked];
    const longestRun = longestConsecutiveRun(daysWorkedArr);
    const warnings = [];
    if (!allowOvertime) {
      for (const [date, hrs] of r.dailyWorked) {
        if (hrs > maxHoursDay) { warnings.push(`${hrs.toFixed(1)}h on ${date}, over the ${maxHoursDay}h/day limit`); break; } // one example is enough to flag the row
      }
    }
    if (longestRun > maxConsecDays) warnings.push(`${longestRun} consecutive working days, over the ${maxConsecDays}-day limit`);

    return {
      staff_id: r.staff_id,
      user_id: r.user_id,
      full_name: r.full_name,
      staff_type: r.staff_type,
      rostered_hours: Math.round(r.rostered_hours * 10) / 10,
      worked_hours: Math.round(r.worked_hours * 10) / 10,
      additional_hours: Math.round(r.additional_hours * 10) / 10,
      overtime_hours: Math.round(r.overtime_hours * 10) / 10,
      hours_partially_unknown: r.hours_unknown_count > 0,
      days_worked: daysWorkedArr.length,
      longest_consecutive_run: longestRun,
      pending_submissions: r.pending_count,
      warnings, // advisory only — never blocks anything, this is the whole point of Task 5
      breaches_limit: warnings.length > 0,
    };
  });

  const totals = rows.reduce((acc, r) => ({
    rostered_hours: acc.rostered_hours + r.rostered_hours,
    worked_hours: acc.worked_hours + r.worked_hours,
    additional_hours: acc.additional_hours + r.additional_hours,
    overtime_hours: acc.overtime_hours + r.overtime_hours,
    pending_submissions: acc.pending_submissions + r.pending_submissions,
  }), { rostered_hours: 0, worked_hours: 0, additional_hours: 0, overtime_hours: 0, pending_submissions: 0 });
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k] * 10) / 10;

  return { rows, totals, branch_id: branchId, start_date: startDateStr, end_date: endDateStr };
}

// GET /api/reports/working-hours
const getWorkingHoursReport = async (req, res) => {
  try {
    const branch_id = Number(req.query.branch_id);
    const { start_date, end_date } = req.query;
    if (!branch_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: "branch_id, start_date, and end_date are required." });
    }
    if (req.user.role !== "system_admin" && !(await verifyBranchAccess(req.user, branch_id))) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    const report = await computeWorkingHoursReport(branch_id, start_date, end_date);

    // Persist to the existing reports table so it appears in Report History, storing the actual
    // parameters and result — unlike every other report_type today (they only log a
    // title/format/period on export; the figures themselves are always recomputed live). This is
    // a deliberate first use of the schema's existing parameters/result_data columns, not an
    // oversight elsewhere — noted in the round's final report.
    const branch = await prisma.branches.findUnique({ where: { branch_id }, select: { name: true } });
    const saved = await prisma.reports.create({
      data: {
        generated_by: req.user.user_id,
        branch_id,
        report_type: "working_hours",
        format: "json",
        title: `${branch?.name || "Branch"} — Working Hours Report (${start_date} to ${end_date})`,
        period_start: new Date(start_date),
        period_end: new Date(end_date),
        parameters: { branch_id, start_date, end_date },
        result_data: report,
      },
    });

    return res.json({ success: true, report_id: saved.report_id, ...report });
  } catch (error) {
    return sendServerError(res, error, req);
  }
};

module.exports = { getWorkingHoursReport, computeWorkingHoursReport };
