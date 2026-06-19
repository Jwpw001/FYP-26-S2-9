const prisma = require("../config/prisma");

async function getCallerOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  return s?.outlet_id || null;
}

const getAvailability = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found for your account." });

    const outletStaff = await prisma.staff.findMany({
      where: { outlet_id: outletId },
      select: { staff_id: true },
    });
    const staffIds = outletStaff.map(s => s.staff_id);

    const availability = await prisma.availability.findMany({
      where: { staff_id: { in: staffIds } },
      include: {
        staff: { include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } } },
      },
    });

    res.json({ success: true, availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAvailabilityById = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const availability = await prisma.availability.findUnique({
      where: { request_id: requestId },
      include: {
        staff: { select: { outlet_id: true, users: { select: { user_id: true, full_name: true, email: true, role: true } } } },
      },
    });

    if (!availability) return res.status(404).json({ success: false, message: "Availability request not found" });
    if (outletId && availability.staff?.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAvailability = async (req, res) => {
  try {
    const { staff_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at } = req.body;
    const availability = await prisma.availability.create({
      data: {
        staff_id,
        leave_type,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        reason,
        status,
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
    const { leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at } = req.body;
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
    res.json({ success: true, message: "Availability request updated successfully", availability });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAvailability = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    await prisma.availability.delete({ where: { request_id: requestId } });
    res.json({ success: true, message: "Availability request deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAvailability, getAvailabilityById, createAvailability, updateAvailability, deleteAvailability };
