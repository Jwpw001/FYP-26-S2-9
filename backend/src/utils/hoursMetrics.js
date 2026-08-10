// Round 3, Task 4 — the three worked-hours metrics, shared by timesheetController (deriving
// hours_worked at submission) and the working-hours report (Task 6). Kept as pure functions
// with no DB access so both callers compute identically from whatever data they've already
// fetched.
//
// Definitions (deliberately NOT the industry default — see the round's brief):
//   Span hours        = actual end − actual start. The raw time on site, before any break.
//   Worked hours      = span − break. This is the PAID figure (hours_worked keeps storing this).
//   Additional hours  = max(0, span − rostered) — measured on SPAN, not net-of-break worked
//                        hours (Round 6, Task 3). "Additional" answers "how much longer were they
//                        on site than rostered", and a break doesn't shorten that: someone who
//                        stays an hour past their rostered window and also takes an hour's break
//                        would show net worked == rostered if this were computed from worked
//                        hours, silently hiding that they stayed late. Time worked beyond the
//                        rostered window while the branch is still open — NOT overtime.
//   Overtime hours    = the portion of the ACTUAL worked window (span, never net of break)
//                        falling outside the branch's operating hours (before opening + after
//                        closing), regardless of what was rostered. A worker recorded 08:00–12:00
//                        at a branch opening at 10:00 has 2.0 overtime hours even though they left
//                        before rostered end. Not adjusted for break: only the break's LENGTH is
//                        recorded, not where in the shift it fell, so there's no way to know
//                        whether it happened inside or outside operating hours — computing
//                        overtime on the raw span is the honest reading given what's known.
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

// Returns { workedHours, spanHours, additionalHours, overtimeHours, hoursUnknown }.
// - hoursUnknown is true when actualStart/actualEnd aren't both present (or are invalid), in
//   which case workedHours falls back to hoursWorkedFallback (the legacy hours_worked value,
//   or null) and spanHours/additionalHours/overtimeHours are null — "unknown", never 0, since 0
//   would falsely claim "no overtime" when the truth is simply "we don't know the actual window".
// - breakMinutes: unpaid break within the span, minutes. Nullable/undefined treated as 0 — no
//   break, matching every pre-Round-6 row exactly (see the timesheets.break_minutes migration
//   comment). Clamped at 0 from below; the caller (timesheetController) is responsible for
//   rejecting a break >= the span before this ever runs, so workedHours going negative here would
//   indicate a caller bug, not valid input — Math.max(0, …) is a defensive floor, not the primary
//   validation.
function computeHoursMetrics({ rosteredStart, rosteredEnd, actualStart, actualEnd, branchOpenTime, branchCloseTime, hoursWorkedFallback, breakMinutes }) {
  const aStart = toMinutes(actualStart);
  const aEnd = toMinutes(actualEnd);

  if (aStart === null || aEnd === null || aEnd <= aStart) {
    const fallback = hoursWorkedFallback === null || hoursWorkedFallback === undefined ? null : Number(hoursWorkedFallback);
    return {
      workedHours: fallback === null || Number.isNaN(fallback) ? null : round1(fallback),
      spanHours: null,
      additionalHours: null,
      overtimeHours: null,
      hoursUnknown: true,
    };
  }

  const spanHours = round1((aEnd - aStart) / 60);
  const breakHours = breakMinutes ? Math.max(0, Number(breakMinutes)) / 60 : 0;
  const workedHours = round1(Math.max(0, spanHours - breakHours));

  const rStart = toMinutes(rosteredStart);
  const rEnd = toMinutes(rosteredEnd);
  let additionalHours = null;
  if (rStart !== null && rEnd !== null && rEnd > rStart) {
    const rosteredHours = (rEnd - rStart) / 60;
    additionalHours = round1(Math.max(0, spanHours - rosteredHours));
  }

  const oStart = toMinutes(branchOpenTime);
  const oEnd = toMinutes(branchCloseTime);
  let overtimeHours = null;
  if (oStart !== null && oEnd !== null && oEnd > oStart) {
    const before = Math.max(0, Math.min(aEnd, oStart) - aStart);
    const after = Math.max(0, aEnd - Math.max(aStart, oEnd));
    overtimeHours = round1((before + after) / 60);
  }

  return { workedHours, spanHours, additionalHours, overtimeHours, hoursUnknown: false };
}

module.exports = { computeHoursMetrics, toMinutes };
