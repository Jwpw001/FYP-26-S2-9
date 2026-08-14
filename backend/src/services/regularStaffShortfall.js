const prisma = require("../config/prisma");
const { getUTCMondayWeekStart } = require("../utils/scheduling");
const { contractedHoursPerWeek } = require("../utils/contractedHours");

// F2: shared between casualController.js's autoAssignCasual gate and
// recommendationService.js's ranking — both need "how many hours is this regular short of
// contract this week" and must agree on how it's computed, so the DB round trip and the
// combination of contracted-vs-rostered hours live here once. The actual contracted-hours math
// is utils/contractedHours.js's; the Monday-aligned week is utils/scheduling.js's
// getUTCMondayWeekStart — this only orchestrates a single batched query around them, the same
// "hours already rostered this week" convention shiftGenerationController.js's P2 seed uses
// (a shift's own end_time − start_time, not the narrower task window).
//
// `staffRows` needs staff_id + default_work_days for each regular staff member being asked
// about (caller already has this from its own staff fetch — this function doesn't re-fetch it,
// so it stays usable whether the caller queried via prisma or supabaseAdmin).
// Returns Map<staff_id, { contractedHours, rosteredHours, shortfallHours }>.
async function computeShortfallByStaffId({ staffRows, referenceDate, workHoursPerDay }) {
  const result = new Map();
  if (staffRows.length === 0) return result;

  const weekStart = getUTCMondayWeekStart(referenceDate);
  const weekEndExclusive = new Date(weekStart);
  weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);

  const staffIds = staffRows.map(s => s.staff_id);
  const assignments = await prisma.task_assignments.findMany({
    where: { staff_id: { in: staffIds }, shifts: { shift_date: { gte: weekStart, lt: weekEndExclusive } } },
    select: { staff_id: true, shifts: { select: { start_time: true, end_time: true } } },
  });

  const rosteredByStaffId = {};
  assignments.forEach(a => {
    if (!a.shifts) return;
    const hrs = Math.max(0, (new Date(a.shifts.end_time) - new Date(a.shifts.start_time)) / 3600000);
    rosteredByStaffId[a.staff_id] = (rosteredByStaffId[a.staff_id] || 0) + hrs;
  });

  staffRows.forEach(s => {
    const contractedHours = contractedHoursPerWeek(s.default_work_days, workHoursPerDay);
    const rosteredHours = rosteredByStaffId[s.staff_id] || 0;
    result.set(s.staff_id, { contractedHours, rosteredHours, shortfallHours: contractedHours - rosteredHours });
  });

  return result;
}

module.exports = { computeShortfallByStaffId };
