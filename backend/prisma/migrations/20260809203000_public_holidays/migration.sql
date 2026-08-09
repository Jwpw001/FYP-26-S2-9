-- Round 3, Task 3: public_holidays + branch_settings.treat_public_holidays_as_working
-- Additive only. One new table, one new NULLABLE column (with a default for new/updated rows —
-- existing branch_settings rows are backfilled to `false`, i.e. "skip public holidays", which is
-- the same behaviour every branch already implicitly has today since this concept didn't exist
-- before). Does not drop, rename, or retype any existing column or table.
-- NOT applied by this change — a human reviews and applies this to the live database.
-- The public_holidays seed data (2026/2027 dates) is a SEPARATE, optional script —
-- see prisma/seed/publicHolidays.sql — deliberately not bundled into this migration so the
-- schema change and the data seed can be reviewed and applied independently.

-- AlterTable
ALTER TABLE "branch_settings" ADD COLUMN "treat_public_holidays_as_working" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "public_holidays" (
    "holiday_id" SERIAL NOT NULL,
    "country_code" VARCHAR(2) NOT NULL DEFAULT 'SG',
    "holiday_date" DATE NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("holiday_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_country_code_holiday_date_key" ON "public_holidays"("country_code", "holiday_date");

-- CreateIndex
CREATE INDEX "idx_public_holidays_country_year" ON "public_holidays"("country_code", "year");
