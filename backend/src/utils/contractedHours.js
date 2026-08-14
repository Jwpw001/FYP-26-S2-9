// Pure helpers for a regular staff member's contracted hours — no database access, so this can
// be unit tested in isolation, following the pattern of utils/scheduling.js.
//
// There is no contracted-hours column anywhere in the schema. What exists is
// staff.default_work_days (a "1111100"-style VarChar(7), which weekdays they're contracted for —
// already used as the eligibility filter in shiftGenerationController.js) and
// branch_settings.work_hours_day (Int, default 8 — nominal hours in a working day). Contracted
// hours per week is derived from those two rather than inventing a new column, per the round's
// brief: "Derive contracted hours rather than inventing a column, unless step 3 shows you need
// one" — it didn't.

// Counts the "1" characters in a default_work_days string (e.g. "1111100" -> 5). Missing/empty
// input (a staff member with no default_work_days set — the existing "data gap" case
// shiftGenerationController.js already reports separately) contracts for 0 days, not a guess.
function countContractedDays(defaultWorkDays) {
  if (!defaultWorkDays) return 0;
  let count = 0;
  for (let i = 0; i < defaultWorkDays.length; i++) {
    if (defaultWorkDays[i] === "1") count++;
  }
  return count;
}

// contracted_hours_per_week = count of "1" in default_work_days × branch_settings.work_hours_day.
function contractedHoursPerWeek(defaultWorkDays, workHoursPerDay) {
  return countContractedDays(defaultWorkDays) * (workHoursPerDay || 0);
}

module.exports = { countContractedDays, contractedHoursPerWeek };
