// Pure scheduling/allocation helpers shared between casualController.js's autoAssignCasual and
// its Jest test suite (see tests/scheduling.test.js). Kept dependency-free (no Prisma/Supabase)
// so this logic can be unit tested in isolation without mocking the database.

// Accepts a Prisma Date object (from a `time`/`timestamp` column) or an "HH:MM[:SS]" string and
// returns minutes since midnight, or null if there's nothing to parse.
function toMinutesFromTimeValue(t) {
  if (!t) return null;
  const s = t instanceof Date ? t.toISOString() : String(t);
  const hhmm = s.includes("T") ? s.slice(11, 16) : s.slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// True if the half-open interval [startA, endA) overlaps [startB, endB). Adjacent windows
// (one ends exactly when the other starts) do not count as overlapping.
function doTimeRangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

// Monday-aligned day-of-week (Mon=0 … Sun=6), computed in UTC. Mixing this with local-time
// getDay() while the rest of the app does UTC date math was the Phase 5 week-alignment bug.
function getUTCDayOfWeekMondayFirst(date) {
  return (date.getUTCDay() + 6) % 7;
}

// The Monday (UTC midnight) that starts the week containing `date`.
function getUTCMondayWeekStart(date) {
  const dayOfWeek = getUTCDayOfWeekMondayFirst(date);
  const weekStart = new Date(date);
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

// Composite score from 0-1 sub-scores and branch_allocation_preferences-style weights (0-100
// scale, conventionally summing to 100). Used by autoAssignCasual and the AI-fallback scorers in
// recommendationService.js / shiftController.js.
// Round 6, Task 10: availability and performance dropped from the scoring model.
// Availability is a hard gate now (candidates who don't pass it never reach this function, see
// autoAssignCasual's hard filter 1 — first the old time-coverage check, now the Task 6 period
// resolution), so weighting it again here would double-count the same signal. Performance has no
// backing data anywhere in the schema (no rating/review table) and was always a fixed neutral
// score that never actually changed a ranking — removed rather than kept as dead weight. See
// casualController.js's autoAssignCasual for the current three-dimension model (skills,
// attendance, workload) and why each weight column still exists in the DB unused.
function computeWeightedScore(subScores, weights) {
  return (
    weights.skills * subScores.skills +
    weights.attendance * subScores.attendance +
    weights.workload * subScores.workload
  );
}

module.exports = {
  toMinutesFromTimeValue,
  doTimeRangesOverlap,
  getUTCDayOfWeekMondayFirst,
  getUTCMondayWeekStart,
  computeWeightedScore,
};
