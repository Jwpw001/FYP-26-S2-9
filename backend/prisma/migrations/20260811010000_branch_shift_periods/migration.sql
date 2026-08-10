-- Round 6, Task 2: named shift periods per branch (e.g. "Morning" 08:00-16:00, "Evening"
-- 16:00-00:00), so generation can create one shift per period per operating day instead of
-- collapsing a whole day into one shift.
-- Additive only — one new table, one new NULLABLE column. No drops/renames/retypes.
-- NOT applied by this change — a human reviews and applies this to the live database.
-- The backfill (giving every existing branch a "Full Day" period and pointing its existing
-- templates at it) is a SEPARATE script — see prisma/seed/branchShiftPeriodsBackfill.sql —
-- deliberately not bundled here so the schema change and the data backfill can be reviewed and
-- applied independently, same split as the public_holidays and industry-catalog migrations.

-- CreateTable
CREATE TABLE "branch_shift_periods" (
    "period_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "active_days" VARCHAR(7) NOT NULL DEFAULT '1111111',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "branch_shift_periods_pkey" PRIMARY KEY ("period_id")
);

-- AddForeignKey
ALTER TABLE "branch_shift_periods" ADD CONSTRAINT "branch_shift_periods_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX "idx_branch_shift_periods_branch" ON "branch_shift_periods"("branch_id");

-- AlterTable
ALTER TABLE "branch_task_templates" ADD COLUMN "period_id" INTEGER;

-- AddForeignKey
ALTER TABLE "branch_task_templates" ADD CONSTRAINT "branch_task_templates_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "branch_shift_periods"("period_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- shift_tasks gets its own period_id too, copied from the template at generation time (same
-- "copy, never reference" pattern already used for title/skill_id/start_time/end_time on this
-- table) — Task 6's availability matching needs to know which period a given task belongs to
-- without re-deriving it from possibly-since-edited start/end times.
-- AlterTable
ALTER TABLE "shift_tasks" ADD COLUMN "period_id" INTEGER;

-- AddForeignKey
ALTER TABLE "shift_tasks" ADD CONSTRAINT "shift_tasks_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "branch_shift_periods"("period_id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- shifts also gets period_id — needed so re-running generation can tell "Morning already
-- generated for this date" apart from "Evening already generated for this date" (idempotency
-- per date+period, not just per date).
-- AlterTable
ALTER TABLE "shifts" ADD COLUMN "period_id" INTEGER;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "branch_shift_periods"("period_id") ON DELETE SET NULL ON UPDATE NO ACTION;
