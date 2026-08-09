-- Seed data for public_holidays: Singapore, 2026 and 2027.
-- Optional and separate from the schema migration — apply this AFTER
-- 20260809203000_public_holidays has been applied.
--
-- Sourcing (see the Round 3 final report for full detail):
--   2026 — cross-verified against two independent sources: the official MOM dataset on
--     data.gov.sg ("Public Holidays for 2026", 14 rows including in-lieu/observed days) and
--     thepublicholiday.com/singapore/. Both agree exactly on all 14 dates below. HIGH confidence.
--   2027 — MOM's own gazette for a given year is typically published around June of the prior
--     year, so full official confirmation may not exist yet depending on when this is applied.
--     The 11 dates below are cross-verified between two independent third-party sources
--     (qppstudio.net and thepublicholiday.com/singapore/2027/), which agree exactly on every
--     date, and the latter states them as MOM-gazetted. MODERATE-HIGH confidence, but a human
--     should spot-check against MOM's own gazette before relying on this for 2027 once it's
--     been officially published, and update this table if anything differs.
--
-- Idempotent: ON CONFLICT DO NOTHING against the (country_code, holiday_date) unique index, so
-- running this twice is harmless.

INSERT INTO "public_holidays" ("country_code", "holiday_date", "name", "year") VALUES
  ('SG', '2026-01-01', 'New Year''s Day',              2026),
  ('SG', '2026-02-17', 'Chinese New Year',              2026),
  ('SG', '2026-02-18', 'Chinese New Year (Day 2)',      2026),
  ('SG', '2026-03-21', 'Hari Raya Puasa',               2026),
  ('SG', '2026-04-03', 'Good Friday',                   2026),
  ('SG', '2026-05-01', 'Labour Day',                    2026),
  ('SG', '2026-05-27', 'Hari Raya Haji',                2026),
  ('SG', '2026-05-31', 'Vesak Day',                     2026),
  ('SG', '2026-06-01', 'Vesak Day (Observed)',          2026),
  ('SG', '2026-08-09', 'National Day',                  2026),
  ('SG', '2026-08-10', 'National Day (Observed)',       2026),
  ('SG', '2026-11-08', 'Deepavali',                     2026),
  ('SG', '2026-11-09', 'Deepavali (Observed)',          2026),
  ('SG', '2026-12-25', 'Christmas Day',                 2026),

  ('SG', '2027-01-01', 'New Year''s Day',                2027),
  ('SG', '2027-02-06', 'Chinese New Year',               2027),
  ('SG', '2027-02-07', 'Chinese New Year (Day 2)',       2027),
  ('SG', '2027-03-10', 'Hari Raya Puasa',                2027),
  ('SG', '2027-03-26', 'Good Friday',                    2027),
  ('SG', '2027-05-01', 'Labour Day',                     2027),
  ('SG', '2027-05-17', 'Hari Raya Haji',                 2027),
  ('SG', '2027-05-20', 'Vesak Day',                      2027),
  ('SG', '2027-08-09', 'National Day',                   2027),
  ('SG', '2027-10-28', 'Deepavali',                      2027),
  ('SG', '2027-12-25', 'Christmas Day',                  2027)
ON CONFLICT ("country_code", "holiday_date") DO NOTHING;
