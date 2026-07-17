const prisma = require("../config/prisma");

async function getCallerOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  return s?.branch_id || null;
}

const getStaff = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found for your account." });

    const staff = await prisma.staff.findMany({
      where: { branch_id: outletId },
      include: {
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        branches: true,
      },
    });
    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStaffById = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const staff = await prisma.staff.findUnique({
      where: { staff_id: staffId },
      include: {
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        branches: true,
      },
    });

    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    if (outletId && staff.branch_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createStaff = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    const { user_id, outlet_id, staff_type, default_work_days, hired_at, is_active } = req.body;

    // Ensure manager can only create staff for their own outlet
    const targetOutlet = outlet_id || outletId;
    if (outletId && targetOutlet !== outletId)
      return res.status(403).json({ success: false, message: "Cannot create staff for a different outlet." });

    const staff = await prisma.staff.create({
      data: { user_id, branch_id: targetOutlet, staff_type, default_work_days, hired_at: hired_at ? new Date(hired_at) : null, is_active },
    });
    res.status(201).json({ success: true, message: "Staff created successfully", staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateStaff = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const existing = await prisma.staff.findUnique({ where: { staff_id: staffId }, select: { branch_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Staff not found" });
    if (outletId && existing.branch_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const { outlet_id, staff_type, default_work_days, hired_at, is_active } = req.body;
    const staff = await prisma.staff.update({
      where: { staff_id: staffId },
      data: { branch_id: outlet_id, staff_type, default_work_days, hired_at: hired_at ? new Date(hired_at) : undefined, is_active },
    });
    res.json({ success: true, message: "Staff updated successfully", staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const existing = await prisma.staff.findUnique({ where: { staff_id: staffId }, select: { branch_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Staff not found" });
    if (outletId && existing.branch_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    await prisma.staff.delete({ where: { staff_id: staffId } });
    res.json({ success: true, message: "Staff deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getStaff, getStaffById, createStaff, updateStaff, deleteStaff };
