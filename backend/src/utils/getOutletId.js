const prisma = require("../config/prisma");

/**
 * Resolves the primary outlet_id for any user role:
 *
 *  - outlet_manager  → looks up outlet_managers table (Option B junction)
 *  - regular_staff / outlet_casual_staff → looks up staff table (unchanged)
 *  - krewby_coordinator / system_admin   → returns null (no outlet scope)
 *
 * Returns the outlet_id (number) or null if not found / not applicable.
 */
async function getOutletId(userId, role) {
  if (role === "outlet_manager") {
    const record = await prisma.outlet_managers.findFirst({
      where: { user_id: userId },
      orderBy: { is_primary: "desc" }, // primary outlet first
    });
    return record?.outlet_id ?? null;
  }

  if (role === "regular_staff" || role === "outlet_casual_staff") {
    const record = await prisma.staff.findFirst({
      where: { user_id: userId, is_active: true },
    });
    return record?.outlet_id ?? null;
  }

  // krewby_coordinator, system_admin, krewby_casual_worker — no outlet scope
  return null;
}

/**
 * Returns all outlet_ids the manager manages (for multi-outlet support).
 * For staff, returns a single-element array.
 */
async function getOutletIds(userId, role) {
  if (role === "outlet_manager") {
    const records = await prisma.outlet_managers.findMany({
      where: { user_id: userId },
    });
    return records.map((r) => r.outlet_id);
  }

  if (role === "regular_staff" || role === "outlet_casual_staff") {
    const record = await prisma.staff.findFirst({
      where: { user_id: userId, is_active: true },
    });
    return record?.outlet_id ? [record.outlet_id] : [];
  }

  return [];
}

module.exports = { getOutletId, getOutletIds };
