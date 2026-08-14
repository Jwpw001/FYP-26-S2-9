-- branch_allocation_preferences.branch_weights_sum_100 and allocation_preferences.
-- weights_sum_100 are CHECK constraints requiring all five weight_* columns to sum to 100 —
-- added directly to the database by hand at some point (not in schema.prisma, no doc-comment
-- flagging a check constraint on either model, no prior migration creating them; found live via
-- pg_constraint after a real save failed with "violates check constraint
-- branch_weights_sum_100"). Round 6, Task 10 rebuilt allocation scoring to three dimensions
-- (skills, attendance, workload) — weight_availability/weight_performance are legacy, unread
-- columns (see casualController.js/recommendationService.js) — and the app-level validation was
-- already updated to match (businessOwnerController.js's updateBranchAllocationPrefs/
-- updateAllocationPrefs, and authController.js's registerBusiness), but these two DB-level
-- constraints were never told about that change: a genuine 100% split across the three live
-- dimensions still failed at the database with the old five-column requirement.
--
-- Backfill first, before touching the constraints, so no existing row is ever left violating
-- either the old or the new constraint mid-migration. Every existing row was still at the
-- original five-way default split (skills:30, attendance:15, workload:5 — 50 of the 100, the
-- rest split between the now-unused availability/performance columns), which does not sum to
-- 100 across just the three live dimensions. Rescaled proportionally rather than overwritten to
-- a flat default, so a row already customized away from the stock split keeps its relative
-- emphasis; the remainder is assigned to workload so integer rounding can't leave a row short of
-- or over 100 (the same "last share gets the remainder" pattern shiftGenerationController.js's
-- required_workers expansion already uses). WHERE guards make this idempotent — a row already
-- summing to 100 across the three dimensions is left untouched.

-- Drop the old five-column constraints FIRST: the backfill below only rebalances
-- skills/attendance/workload, which would push the five-column total over 100 and fail against
-- the old constraint if it were still in place while backfilling.
ALTER TABLE "branch_allocation_preferences" DROP CONSTRAINT IF EXISTS "branch_weights_sum_100";
ALTER TABLE "allocation_preferences" DROP CONSTRAINT IF EXISTS "weights_sum_100";

UPDATE "branch_allocation_preferences"
SET
  weight_skills = ROUND(weight_skills * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int,
  weight_attendance = ROUND(weight_attendance * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int,
  weight_workload = 100
    - ROUND(weight_skills * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int
    - ROUND(weight_attendance * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int
WHERE weight_skills + weight_attendance + weight_workload <> 100;

UPDATE "allocation_preferences"
SET
  weight_skills = ROUND(weight_skills * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int,
  weight_attendance = ROUND(weight_attendance * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int,
  weight_workload = 100
    - ROUND(weight_skills * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int
    - ROUND(weight_attendance * 100.0 / NULLIF(weight_skills + weight_attendance + weight_workload, 0))::int
WHERE weight_skills + weight_attendance + weight_workload <> 100;

-- New constraints: only the three dimensions scoring actually reads must sum to 100.
-- weight_availability/weight_performance are intentionally left unconstrained — still present,
-- still writable, just no longer meaningful, matching their "kept as columns, never read" status
-- already documented at the application level. Guarded with a DO block (Postgres has no
-- "ADD CONSTRAINT IF NOT EXISTS") so this migration is safe to run again.
DO $$ BEGIN
  ALTER TABLE "branch_allocation_preferences" ADD CONSTRAINT "branch_weights_sum_100" CHECK (weight_skills + weight_attendance + weight_workload = 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "allocation_preferences" ADD CONSTRAINT "weights_sum_100" CHECK (weight_skills + weight_attendance + weight_workload = 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
