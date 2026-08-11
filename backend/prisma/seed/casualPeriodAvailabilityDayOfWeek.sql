-- OPT 5: per-day granularity for casual period availability.
-- Report only — NOT applied by this change. Run manually against the target database when ready.
--
-- Adds a nullable day_of_week to casual_period_availability so a casual worker can express
-- availability for one specific day within a period-week ("Monday and Wednesday evening"),
-- instead of only "the whole week for this period".
--
-- NULL day_of_week  = available all operating days that week for this period (existing behaviour,
--                      unchanged for every row written before this migration).
-- 0-6 day_of_week    = available only that specific day. Mon=0 … Sun=6, the same convention
--                      already used by casual_standing_availability.day_of_week.
--
-- The existing uniqueness guard is a plain UNIQUE INDEX (verified against the live schema via
-- pg_indexes — it is NOT a named table constraint, so it must be dropped with DROP INDEX, not
-- ALTER TABLE ... DROP CONSTRAINT):
--   casual_period_availability_staff_week_period_key ON (staff_id, week_start_date, period_id)
-- It's replaced with a 4-column version that also includes day_of_week, using
-- NULLS NOT DISTINCT (Postgres 15+) so two NULL-day_of_week rows for the same
-- (staff_id, week_start_date, period_id) still collide as duplicates, exactly like today —
-- without that clause, Postgres treats every NULL as distinct and the "one whole-week row per
-- period per week" guarantee would silently stop being enforced.

ALTER TABLE casual_period_availability
  ADD COLUMN day_of_week SMALLINT;

DROP INDEX casual_period_availability_staff_week_period_key;

CREATE UNIQUE INDEX casual_period_availability_staff_week_period_day_key
  ON casual_period_availability (staff_id, week_start_date, period_id, day_of_week)
  NULLS NOT DISTINCT;
