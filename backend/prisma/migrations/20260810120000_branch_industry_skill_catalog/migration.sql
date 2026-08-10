-- Branch-level industry tag + reusing skills.is_catalog/industry_type (already live in the DB,
-- introspected into schema.prisma, but never populated or read by any controller until now).
-- Additive only — one new nullable column, no drops/retypes.
-- NOT applied by this change — a human reviews and applies this to the live database.
-- Catalog seed data (the actual F&B/Clinic/Outlet role-tag rows) is a SEPARATE script —
-- see prisma/seed/skillsCatalog.sql — same split as the public_holidays migration/seed pair.

-- AlterTable
ALTER TABLE "branch_settings" ADD COLUMN "industry" VARCHAR(30);
