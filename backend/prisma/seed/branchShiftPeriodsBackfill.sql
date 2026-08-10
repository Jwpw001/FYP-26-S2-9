-- Round 6, Task 2 backfill: gives every existing branch a single "Full Day" period spanning its
-- current open_time/close_time, then points every existing branch_task_templates row at it.
-- This is what makes the round's regression guarantee true: a branch with exactly one full-day
-- period generates one shift per operating day covering operating hours — identical to
-- pre-Round-6 behaviour (see generateShiftsForBranch's own comment).
-- Optional and separate from the schema migration — apply this AFTER
-- 20260811010000_branch_shift_periods has been applied.
--
-- Idempotent: guarded on "this branch has zero periods yet" — running it twice does not create a
-- second default period for a branch, and does not touch a branch that has since had periods
-- added (by this script or a manager) with a nonzero row.

-- Step 1: one "Full Day" period per branch that doesn't already have any period.
INSERT INTO "branch_shift_periods" ("branch_id", "name", "start_time", "end_time", "active_days", "sort_order", "is_active")
SELECT b.branch_id, 'Full Day', COALESCE(b.open_time, '08:00:00'), COALESCE(b.close_time, '22:00:00'), '1111111', 0, true
FROM "branches" b
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM "branch_shift_periods" p WHERE p.branch_id = b.branch_id);

-- Step 2: point every existing template with no period at its branch's (now-guaranteed-to-exist)
-- earliest/default period. Only touches rows that are still NULL, so re-running is a no-op once
-- every template has been assigned once — including templates created after step 1 already ran,
-- which a manager may have deliberately left unassigned (Task 2's "null period_id" decision), so
-- this step is intentionally scoped to a single backfill pass rather than something safe to
-- re-run indefinitely. Re-running step 1 alone remains always-safe.
UPDATE "branch_task_templates" t
SET "period_id" = p.period_id
FROM (
  SELECT DISTINCT ON (branch_id) branch_id, period_id
  FROM "branch_shift_periods"
  ORDER BY branch_id, sort_order ASC, period_id ASC
) p
WHERE t.branch_id = p.branch_id
  AND t.period_id IS NULL;
