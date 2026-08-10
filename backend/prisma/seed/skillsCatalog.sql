-- Seed data for the industry role-tag catalog: is_catalog=true, industry_type set, branch_id
-- and business_id left NULL (these are platform-wide suggestion templates, not owned by any one
-- business — distinct from custom skills a business creates for itself, which now get
-- business_id stamped in createBranchSkill).
-- Optional and separate from the schema migration — apply this AFTER
-- 20260810120000_branch_industry_skill_catalog has been applied.
--
-- Idempotent: skills.name has no unique constraint against a NULL branch_id (Postgres treats
-- distinct NULLs as non-conflicting, so ON CONFLICT can't be used here), so this guards
-- duplication with a WHERE NOT EXISTS check per row instead. Running this twice is harmless.

INSERT INTO "skills" ("name", "description", "industry_type", "is_catalog", "branch_id", "business_id")
SELECT v.name, v.description, v.industry_type, true, NULL, NULL
FROM (VALUES
  ('Kitchen Staff',    'Prepares food to recipe and safety standard.',              'fnb'),
  ('Service Staff',    'Takes orders and serves customers on the floor.',           'fnb'),
  ('Barista',          'Prepares espresso-based and specialty drinks.',             'fnb'),
  ('Bartender',        'Prepares and serves alcoholic and non-alcoholic beverages.','fnb'),
  ('Doctor',           'Diagnoses and treats patients.',                           'clinic'),
  ('Nurse',            'Provides patient care and assists with treatment.',        'clinic'),
  ('Receptionist',     'Manages appointments and front-desk patient intake.',      'clinic'),
  ('Pharmacist',       'Dispenses medication and advises on usage.',               'clinic'),
  ('Cashier',          'Handles checkout, payments, and receipts.',                'outlet'),
  ('Sales Associate',  'Assists customers and drives in-store sales.',             'outlet'),
  ('Stock Clerk',      'Receives, stocks, and organizes inventory.',               'outlet'),
  ('Store Supervisor', 'Oversees daily floor operations and staff.',               'outlet')
) AS v(name, description, industry_type)
WHERE NOT EXISTS (
  SELECT 1 FROM "skills" s WHERE s.name = v.name AND s.is_catalog = true
);
