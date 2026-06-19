const prisma = require("../config/prisma");

async function getCallerOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  return s?.outlet_id || null;
}

const getShifts = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found for your account." });

    const shifts = await prisma.shifts.findMany({
      where: { outlet_id: outletId },
      include: {
        outlets: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        shift_roles: true,
        shift_assignments: true,
      },
      orderBy: { shift_date: "asc" },
    });
    res.json({ success: true, shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getShiftById = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const shift = await prisma.shifts.findUnique({
      where: { shift_id: shiftId },
      include: {
        outlets: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        shift_roles: true,
        shift_assignments: true,
      },
    });

    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (outletId && shift.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    const callerOutletId = await getCallerOutletId(req.user.user_id);
    const { outlet_id, title, shift_date, start_time, end_time, status } = req.body;

    // Ensure manager can only create shifts for their own outlet
    if (callerOutletId && outlet_id && outlet_id !== callerOutletId)
      return res.status(403).json({ success: false, message: "Cannot create shifts for a different outlet." });

    const shift = await prisma.shifts.create({
      data: {
        outlet_id: outlet_id || callerOutletId,
        title,
        shift_date: new Date(shift_date),
        start_time: new Date(`1970-01-01T${start_time}`),
        end_time: new Date(`1970-01-01T${end_time}`),
        status,
        created_by: req.user.user_id,
      },
    });
    res.status(201).json({ success: true, message: "Shift created successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { outlet_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (outletId && existing.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const { outlet_id, title, shift_date, start_time, end_time, status } = req.body;
    const shift = await prisma.shifts.update({
      where: { shift_id: shiftId },
      data: {
        outlet_id,
        title,
        shift_date: shift_date ? new Date(shift_date) : undefined,
        start_time: start_time ? new Date(`1970-01-01T${start_time}`) : undefined,
        end_time: end_time ? new Date(`1970-01-01T${end_time}`) : undefined,
        status,
      },
    });
    res.json({ success: true, message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { outlet_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (outletId && existing.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    await prisma.shifts.delete({ where: { shift_id: shiftId } });
    res.json({ success: true, message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getShifts, getShiftById, createShift, updateShift, deleteShift };
