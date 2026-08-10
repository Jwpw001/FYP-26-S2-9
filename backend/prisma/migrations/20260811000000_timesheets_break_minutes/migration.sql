-- Round 6, Task 3: unpaid break/rest time on timesheets.
-- Additive only — one new NULLABLE column, no drops/renames/retypes.
-- Existing rows read as NULL, which the application code treats identically to 0 (no break, no
-- change in behaviour) — no backfill needed or performed.
-- NOT applied by this change — a human reviews and applies this to the live database.

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN "break_minutes" INTEGER;
