// Round 3, Task 4 — the three worked-hours metrics, shared by timesheetController (deriving
// hours_worked at submission) and the working-hours report (Task 6). Kept as pure functions
// with no DB access so both callers compute identically from whatever data they've already
// fetched.
//
// Definitions (deliberately NOT the industry default — see the round's brief):
//   Worked hours      = actual end − actual start.
//   Additional hours  = worked − rostered, clamped to 0 when not positive. Time worked beyond
//                        the rostered window while the branch is still open — NOT overtime.
//   Overtime hours    = the portion of the ACTUAL worked window falling outside the branch's
//                        operating hours (before opening + after closing), regardless of what
//                        was rostered. A worker recorded 08:00–12:00 at a branch opening at
//                        10:00 has 2.0 overtime hours even though they left before rostered end.
//
// Midnight-crossing shifts are NOT supported here, matching the rest of the app: shift creation
// already rejects end_time <= start_time (see CreateShift.jsx / shiftValidator), so a "shift
// crossing midnight" isn't representable anywhere else in this schema either. Actual end <=
// actual start is therefore treated as an input error, not a next-day rollover — rejected at
// submission (timesheetController.submitReport) and, defensively, treated as "unknown" here if
// it somehow reaches this function anyway (never negative, never silently wrong).

function toMinutes(t) {
  if (t === null || t === undefined) return null;
  const s = t instanceof Date ? t.toISOString().slice(11, 16) : String(t).slice(0, 5);
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Returns { workedHours, additionalHours, overtimeHours, hoursUnknown }.
// - hoursUnknown is true when actualStart/actualEnd aren't both present (or are invalid), in
//   which case workedHours falls back to hoursWorkedFallback (the legacy hours_worked value,
//   or null) and additionalHours/overtimeHours are null — "unknown", never 0, since 0 would
//   falsely claim "no overtime" when the truth is simply "we don't know the actual window".
function computeHoursMetrics({ rosteredStart, rosteredEnd, actualStart, actualEnd, branchOpenTime, branchCloseTime, hoursWorkedFallback }) {
  const aStart = toMinutes(actualStart);
  const aEnd = toMinutes(actualEnd);

  if (aStart === null || aEnd === null || aEnd <= aStart) {
    const fallback = hoursWorkedFallback === null || hoursWorkedFallback === undefined ? null : Number(hoursWorkedFallback);
    return {
      workedHours: fallback === null || Number.isNaN(fallback) ? null : round1(fallback),
      additionalHours: null,
      overtimeHours: null,
      hoursUnknown: true,
    };
  }

  const workedHours = round1((aEnd - aStart) / 60);

  const rStart = toMinutes(rosteredStart);
  const rEnd = toMinutes(rosteredEnd);
  let additionalHours = null;
  if (rStart !== null && rEnd !== null && rEnd > rStart) {
    const rosteredHours = (rEnd - rStart) / 60;
    additionalHours = round1(Math.max(0, workedHours - rosteredHours));
  }

  const oStart = toMinutes(branchOpenTime);
  const oEnd = toMinutes(branchCloseTime);
  let overtimeHours = null;
  if (oStart !== null && oEnd !== null && oEnd > oStart) {
    const before = Math.max(0, Math.min(aEnd, oStart) - aStart);
    const after = Math.max(0, aEnd - Math.max(aStart, oEnd));
    overtimeHours = round1((before + after) / 60);
  }

  return { workedHours, additionalHours, overtimeHours, hoursUnknown: false };
}

module.exports = { computeHoursMetrics, toMinutes };
