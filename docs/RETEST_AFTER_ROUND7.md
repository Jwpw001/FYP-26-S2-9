# Retest guide — Round 7 (P0–P3, F1–F3)

For the QA lead, two days before submission. This is a targeted retest list, not the full 302
cases. **I do not have the test workbook itself** — I only have the two case IDs quoted in this
round's brief (`TC-UR-01-01`, `TC-BO-03-05`). Every other row below is matched by feature/scenario,
not a workbook ID, because I have no way to look one up. Please fill in the ID column from the
workbook when you triage this list — the description is precise enough to find the right row.

Branch: `integration/round7` (all of P0–P3 and F1–F3 merged and verified together — see the
end-of-round report for the merge/test-count/migration verification).

---

## Will flip from Fail/Failed to Pass

Both traced directly to P0's missing migrations (`business_settings` and
`branch_allocation_preferences` tables didn't exist outside the environment `schema.prisma` was
introspected from).

| ID | Case | Was failing with | Expected now |
|---|---|---|---|
| `TC-UR-01-01` | Register business, valid input | `Could not find the table 'public.business_settings' in the schema cache` | Registration completes, Business Owner account created |
| `TC-BO-03-05` | Save smart allocation weights | Same error for `branch_allocation_preferences` | Weights save successfully |

If either still fails, the environment's database was not rebuilt from
`prisma migrate deploy` (or `migrate resolve --applied` wasn't run first on a database that
already had these tables by hand) — see the migration notes in the end-of-round report before
re-triaging as a code bug.

---

## Needs re-confirmation — code you're already testing changed underneath it

Not new bugs, not expected to change pass/fail outcome — but the implementation changed enough
that a fresh run is worth more than assuming the old result still holds.

### Shift generation (P1 — performance restructure)

| ID (fill in) | Case (by feature) | What changed | Expected result |
|---|---|---|---|
| — | Generate shifts for a branch (any horizon a manager would normally use, e.g. the default 56-day rolling window) | `generateShiftsForBranch` rewritten from per-shift/per-placement DB calls to a single batched transaction. Same inputs should produce the same shifts/tasks/placements — just much faster. | Generation completes in a few seconds rather than potentially minutes; created dates, skip reasons, and auto-populated counts in the response match what the same input produced before |
| — | Re-run generation over a range that already has shifts (idempotency case) | Same restructure | Existing dates are skipped with the same reasons ("already generated" / "a manual shift already exists..."), nothing duplicated |
| — | Generate shifts for a branch using shift periods (Morning/Evening etc.) | Same restructure, periods path included | One shift per active period per operating day, same as before, still respects "at most one shift per regular staff per day" |

### Regular-staff placement priority (P2 + F2)

This is the one with an actual behavior change worth deliberately re-testing, not just
re-confirming.

| ID (fill in) | Case (by feature) | What changed | Expected result |
|---|---|---|---|
| — | Generate shifts with more contracted regular staff than open tasks on a day | Staff are now placed in descending order of "shortfall" (contracted hours this week minus hours already rostered), not `staff.findMany`'s arbitrary return order | Whoever is furthest below their contracted hours for the week gets the open task(s) first |
| — | Auto-assign a casual worker to an open task (`POST /api/casual/manager/auto-assign`) while a contracted-today regular is free and below their weekly hours | **New hard gate.** Previously this would score and assign the casual normally. | Request now returns `{ success: false, flagged: true, reason: "<names> ... below contracted hours ... assign ... before a casual worker." }` — no assignment made. If this case doesn't exist yet in the workbook, it should be added; it's new behavior, not a fix to an existing case. |
| — | Auto-assign a casual when the only short regular is already booked that date / on approved leave / has an approved off-day / isn't contracted that weekday | Same gate, but it must NOT block in these cases | Casual is assigned normally, same response shape as before |
| — | Manually assign a specific staff member to a task (`PATCH /api/shifts/tasks/:taskId/assign`) while a regular is short of contract | Explicitly untouched — this is the documented escape hatch | Assignment succeeds regardless, exactly as before (checkLaborRules may still warn, non-blocking) |
| — | AI shift recommendations (`getShiftRecommendations`) for a task where a contracted-today regular is short of hours and a casual has a stronger raw match | Deterministic fallback now ranks short regulars above everyone else before slicing to the top 3; the AI prompt path was given the same signal but can't be guaranteed the way the fallback can | The short regular should appear first (or at least not below the casual) among the suggestions; if the AI path (not the deterministic fallback) produces a different order, that's a known soft spot — see the end-of-round report, not a regression to file blind |

### Labor-rule checks (P1 — N+1 fix)

| ID (fill in) | Case (by feature) | What changed | Expected result |
|---|---|---|---|
| — | Auto-assign casual: a candidate who would breach max daily hours or max consecutive days is ranked lower, not excluded | `checkLaborRules`'s own query is now bounded to a date window instead of unbounded, and `autoAssignCasual` prefetches it once for the whole candidate pool instead of once per candidate | Same soft-penalty behavior and warning text as before — this is a performance-only change, not a rule-logic change |

---

## No retest needed

- **P3 (outlet terminology cleanup)** — comments only, plus one internal `StyleSheet` key rename in
  two mobile screens (`s.outlet` → `s.branchName`) that is never displayed. No user-visible
  behavior changed anywhere in this round.
- **F3 (index benchmark)** — no code change; a schema comment documenting a measurement
  correction. Nothing to retest.

---

## Explicitly NOT fixed by this round

The `UR-05` password-recovery cases are blocked on SMTP being unavailable in the test environment
— an environment/config problem, not a code one. Nothing in P0–P3 or F1–F3 touches email delivery
or password recovery. Do not expect these to change; re-testing them will reproduce the same
block.

---

## How to use this list

1. Run the two `Will flip` rows first — if either still fails, stop and check the database rebuild
   before doing anything else in this list.
2. For each `Needs re-confirmation` row, find the matching workbook ID by feature area and re-run
   it — expected result is stated, so a mismatch is worth a closer look, not an automatic re-file.
3. Everything else in the 302 stays as last measured; this round did not touch it.
