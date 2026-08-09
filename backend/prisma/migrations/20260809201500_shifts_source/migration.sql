-- Round 3, Task 2: shifts.source
-- Additive only. Adds one new NULLABLE column to an existing table, no default value, so every
-- existing row is simply NULL (application code already treats NULL as "manual", its prior
-- implicit behaviour). Does not drop, rename, or retype any existing column. Does not touch data.
-- NOT applied by this change — a human reviews and applies this to the live database.

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN "source" VARCHAR(20);
