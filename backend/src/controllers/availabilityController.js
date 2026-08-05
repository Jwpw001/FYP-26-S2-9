const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { logAudit } = require("../utils/auditLog");

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

// Attaches each row's staff member's annual-leave entitlement and how many days of approved
// annual leave they've already used this calendar year, so a manager reviewing a request can
// see the balance instead of approving blind. This is informational only — it doesn't block
// approval, since real businesses often have legitimate reasons to grant leave past entitlement.
async function attachLeaveEntitlement(rows) {
  const staffIds = [...new Set(rows.map(r => r.staff_id).filter(Boolean))];
  if (staffIds.length === 0) return rows;

  const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);
  const yearEnd   = new Date(`${new Date().getFullYear()}-12-31T23:59:59Z`);

  const [entitlements, approvedThisYear] = await Promise.all([
    prisma.staff.findMany({ where: { staff_id: { in: staffIds } }, select: { staff_id: true, annual_leave_days_per_year: true } }),
    prisma.availability.findMany({
      where: { staff_id: { in: staffIds }, leave_type: "annual", status: "approved", start_date: { gte: yearStart, lte: yearEnd } },
      select: { staff_id: true, start_date: true, end_date: true },
    }),
  ]);

  const entitlementMap = Object.fromEntries(entitlements.map(e => [e.staff_id, e.annual_leave_days_per_year]));
  const usedMap = {};
  approvedThisYear.forEach(a => {
    const days = Math.max(1, Math.round((new Date(a.end_date) - new Date(a.start_date)) / 86400000) + 1);
    usedMap[a.staff_id] = (usedMap[a.staff_id] || 0) + days;
  });

  return rows.map(r => ({
    ...r,
    annual_leave_entitlement: entitlementMap[r.staff_id] ?? null,
    annual_leave_used_this_year: usedMap[r.staff_id] || 0,
  }));
}

const getAvailability = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found for your account." });

    const branchStaff = await prisma.staff.findMany({
      where: { branch_id: branchId },
      select: { staff_id: true },
    });
    const staffIds = branchStaff.map(s => s.staff_id);

    const availability = await prisma.availability.findMany({
      where: { staff_id: { in: staffIds } },
      include: {
        staff: { include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } } },
      },
    });

    const withEntitlement = await attachLeaveEntitlement(availability);
    res.json({ success: true, availability: withEntitlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAvailabilityById = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const availability = await prisma.availability.findUnique({
      where: { request_id: requestId },
      include: {
        staff: { select: { branch_id: true, users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } } },
      },
    });

    if (!availability) return res.status(404).json({ success: false, message: "Availability request not found" });
    if (branchId && availability.staff?.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const [withEntitlement] = await attachLeaveEntitlement([availability]);
    res.json({ success: true, availability: withEntitlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const isSelfServiceRole = role => role === "regular_staff" || role === "casual_staff";

const createAvailability = async (req, res) => {
  try {
    const callerRole = req.dbUser.role;
    let { staff_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at } = req.body;

    if (isSelfServiceRole(callerRole)) {
      // Staff can only ever file a leave request for themselves, and it always starts pending —
      // status/reviewer fields in the body are ignored so a staff member can't self-approve.
      const myStaff = await prisma.staff.findFirst({ where: { user_id: req.user.user_id }, select: { staff_id: true } });
      if (!myStaff) return res.status(404).json({ success: false, message: "Staff profile not found." });
      staff_id = myStaff.staff_id;
      status = "pending";
      reviewed_by = null;
      reviewed_at = null;
    } else {
      const branchId = await getCallerBranchId(req.user.user_id);
      if (branchId) {
        const targetStaff = await prisma.staff.findUnique({ where: { staff_id }, select: { branch_id: true } });
        if (!targetStaff || targetStaff.branch_id !== branchId) {
          return res.status(403).json({ success: false, message: "That staff member is not in your branch." });
        }
      }
    }

    const availability = await prisma.availability.create({
      data: {
        staff_id,
        leave_type,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        reason,
        status: status || "pending",
        reviewed_by,
        reviewed_at: reviewed_at ? new Date(reviewed_at) : null,
      },
    });
    res.status(201).json({ success: true, message: "Availability request created successfully", availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAvailability = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const callerRole = req.dbUser.role;

    const existing = await prisma.availability.findUnique({
      where: { request_id: requestId },
      include: { staff: { select: { branch_id: true, user_id: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Availability request not found" });

    let { leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at } = req.body;

    if (isSelfServiceRole(callerRole)) {
      if (existing.staff.user_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: "You can only edit your own leave requests." });
      }
      // A staff member can amend the details of their own request but can never approve/reject
      // it or set a reviewer themselves — that must go through a manager/admin.
      status = undefined;
      reviewed_by = undefined;
      reviewed_at = undefined;
    } else {
      const branchId = await getCallerBranchId(req.user.user_id);
      if (branchId && existing.staff.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: "Access denied." });
      }
    }

    const availability = await prisma.availability.update({
      where: { request_id: requestId },
      data: {
        leave_type,
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        reason,
        status,
        reviewed_by,
        reviewed_at: reviewed_at ? new Date(reviewed_at) : undefined,
      },
    });

    if (status && status !== existing.status) {
      await logAudit({
        actorId: req.user.user_id,
        action: `leave_${status}`,
        entity: "availability",
        entityId: requestId,
        before: { status: existing.status },
        after: { status },
      });
    }

    res.json({ success: true, message: "Availability request updated successfully", availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAvailability = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.availability.findUnique({
      where: { request_id: requestId },
      select: { staff_id: true, leave_type: true, status: true, start_date: true, end_date: true, staff: { select: { branch_id: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Availability request not found" });
    if (branchId && existing.staff?.branch_id !== branchId) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await prisma.availability.delete({ where: { request_id: requestId } });

    await logAudit({
      actorId: req.user.user_id,
      action: "leave_deleted",
      entity: "availability",
      entityId: requestId,
      before: { staff_id: existing.staff_id, leave_type: existing.leave_type, status: existing.status },
      after: null,
    });

    res.json({ success: true, message: "Availability request deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Staff cancel their own pending leave — does not require manager role
const cancelOwnLeave = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const userId = req.user?.user_id;

    const staffRecord = await prisma.staff.findFirst({ where: { user_id: userId }, select: { staff_id: true } });
    if (!staffRecord) return res.status(403).json({ success: false, message: "No staff record found." });

    const leave = await prisma.availability.findUnique({ where: { request_id: requestId } });
    if (!leave) return res.status(404).json({ success: false, message: "Leave request not found." });
    if (leave.staff_id !== staffRecord.staff_id) return res.status(403).json({ success: false, message: "You can only cancel your own leave requests." });
    if (leave.status !== "pending") return res.status(400).json({ success: false, message: "Only pending leave requests can be cancelled." });

    await prisma.availability.delete({ where: { request_id: requestId } });
    res.json({ success: true, message: "Leave request cancelled." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAvailability, getAvailabilityById, createAvailability, updateAvailability, deleteAvailability, cancelOwnLeave };
