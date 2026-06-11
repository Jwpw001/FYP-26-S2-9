-- =============================================================
-- Migration: Add outlet_managers junction table
-- Project:   CSIT321 FYP-26-S2-9 (Krewby)
-- Reason:    outlet_manager users had no schema link to outlets.
--            All controllers were falling back to staff.findFirst()
--            which returns null for managers, breaking outlet-scoped
--            queries across shifts, staff, krewby, availability, reports.
-- =============================================================

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS outlet_managers (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  outlet_id    INT NOT NULL REFERENCES outlets(outlet_id) ON DELETE CASCADE,
  is_primary   BOOLEAN NOT NULL DEFAULT true,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_outlet_managers_user ON outlet_managers(user_id);

-- 2. Seed: link existing outlet_manager users to their outlet
--    Bob lee (bob@krewby.com) → outlet 1
--    Adjust outlet_id if your outlets table uses a different ID.

INSERT INTO outlet_managers (user_id, outlet_id, is_primary)
SELECT u.user_id, 1, true
FROM   users u
WHERE  u.email = 'bob@krewby.com'
  AND  u.role  = 'outlet_manager'
ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- 3. If you have more outlet managers, add them here:
-- INSERT INTO outlet_managers (user_id, outlet_id, is_primary)
-- SELECT u.user_id, <outlet_id>, true
-- FROM   users u
-- WHERE  u.email = '<manager_email>'
-- ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- =============================================================
-- Verification query (run after migration to confirm)
-- =============================================================
-- SELECT u.email, u.role, om.outlet_id, o.name AS outlet_name
-- FROM   outlet_managers om
-- JOIN   users   u ON u.user_id   = om.user_id
-- JOIN   outlets o ON o.outlet_id = om.outlet_id;
