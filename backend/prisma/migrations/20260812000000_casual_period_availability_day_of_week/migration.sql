-- casual_period_availability was missing a column that schema.prisma has declared since it was
-- written: Round 6 Task 6 (20260811020000_casual_period_availability) created the table keyed on
-- (staff_id, week_start_date, period_id) — availability for a whole period, any day that week.
-- schema.prisma's model narrows a row to one specific day within that period
-- (`day_of_week Int? @db.SmallInt`, nullable so existing period-wide rows keep meaning "every
-- day of the period" unless a day is specified), but the migration adding that column was never
-- written. Same class of bug as the missing business_settings/branch_allocation_preferences
-- tables (schema.prisma drifted ahead of prisma/migrations/), just a column instead of a whole
-- table — found while verifying the P0 baseline migration by diffing a from-migrations database
-- against schema.prisma.
--
-- Additive only: one nullable column, no default needed (existing rows read as NULL, i.e.
-- "unspecified day" = period-wide, their existing behaviour), and the unique index widens to
-- include it rather than narrowing. casual_standing_availability's index is only being renamed to
-- match Prisma's auto-generated name for its @@unique — no column or constraint behaviour change.

-- AlterTable
ALTER TABLE "casual_period_availability" ADD COLUMN IF NOT EXISTS "day_of_week" SMALLINT;

-- DropIndex
DROP INDEX IF EXISTS "casual_period_availability_staff_week_period_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "casual_period_availability_staff_id_week_start_date_period__key" ON "casual_period_availability"("staff_id", "week_start_date", "period_id", "day_of_week");

-- RenameIndex
DO $$ BEGIN
  ALTER INDEX "casual_standing_availability_staff_period_day_key" RENAME TO "casual_standing_availability_staff_id_period_id_day_of_week_key";
EXCEPTION WHEN undefined_object OR duplicate_table THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
