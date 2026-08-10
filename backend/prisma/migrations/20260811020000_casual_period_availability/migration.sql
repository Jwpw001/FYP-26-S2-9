-- Round 6, Task 6: period-based casual availability.
-- Additive only — no existing table/column is touched. casual_availability and
-- casual_weekly_availability are left in place as-is (history / legacy readers).

-- Explicit per-week availability: presence of a row = available for that period that week.
-- A period simply absent for a week that HAS other rows means "not available" for it —
-- resolution semantics are enforced in application code, not by this schema.
CREATE TABLE "casual_period_availability" (
    "id" SERIAL PRIMARY KEY,
    "staff_id" INTEGER NOT NULL,
    "week_start_date" DATE NOT NULL,
    "period_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "casual_period_availability_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "casual_period_availability_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "branch_shift_periods"("period_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "casual_period_availability_staff_week_period_key"
    ON "casual_period_availability"("staff_id", "week_start_date", "period_id");

CREATE INDEX "idx_casual_period_availability_staff_week"
    ON "casual_period_availability"("staff_id", "week_start_date");

-- Recurring pattern: "I can usually work this period on this weekday" — used only when a week
-- has no explicit casual_period_availability rows at all.
CREATE TABLE "casual_standing_availability" (
    "id" SERIAL PRIMARY KEY,
    "staff_id" INTEGER NOT NULL,
    "period_id" INTEGER NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "casual_standing_availability_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "casual_standing_availability_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "branch_shift_periods"("period_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "casual_standing_availability_staff_period_day_key"
    ON "casual_standing_availability"("staff_id", "period_id", "day_of_week");

CREATE INDEX "idx_casual_standing_availability_staff"
    ON "casual_standing_availability"("staff_id");
