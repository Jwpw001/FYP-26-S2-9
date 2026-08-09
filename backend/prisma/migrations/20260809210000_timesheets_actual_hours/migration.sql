-- Round 3, Task 4: timesheets.start_time / timesheets.end_time
-- Additive only. Two new NULLABLE columns, no default, on an existing table. Every existing row
-- has neither (they only ever recorded hours_worked) and reads as NULL — application code
-- already treats that as "no actual start/end recorded", falling back to hours_worked.
-- Does not drop, rename, or retype any existing column. Does not touch data.
-- NOT applied by this change — a human reviews and applies this to the live database.

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN "start_time" TIME(6);
ALTER TABLE "timesheets" ADD COLUMN "end_time" TIME(6);
