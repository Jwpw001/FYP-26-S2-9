const prisma = require("../config/prisma");

async function getCallerOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  return s?.outlet_id || null;
}

const getAttendance = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found for your account." });

    // Get all staff in this outlet, then filter attendance by their assignment ids
    const outletStaff = await prisma.staff.findMany({
      where: { outlet_id: outletId },
      select: { staff_id: true },
    });
    const staffIds = outletStaff.map(s => s.staff_id);

    // Attendance links to task_assignments; scope via task_assignments.staff_id
    const attendance = await prisma.attendance.findMany({
      where: {
        task_assignments: { staff_id: { in: staffIds } },
      },
      include: {
        task_assignments: {
          include: {
            staff: { include: { users: { select: { full_name: true, email: true } } } },
            shifts: { select: { shift_date: true, title: true } },
          },
        },
      },
      orderBy: { attendance_id: "asc" },
    });

    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAttendanceById = async (req, res) => {
  try {
    const attendanceId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const attendance = await prisma.attendance.findUnique({
      where: { attendance_id: attendanceId },
      include: {
        task_assignments: { include: { shifts: { select: { outlet_id: true } } } },
      },
    });

    if (!attendance) return res.status(404).json({ success: false, message: "Attendance record not found" });
    if (outletId && attendance.task_assignments?.shifts?.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAttendance = async (req, res) => {
  try {
    const { assignment_id, clock_in, clock_out, status } = req.body;
    const attendance = await prisma.attendance.create({
      data: {
        assignment_id,
        clock_in: clock_in ? new Date(clock_in) : null,
        clock_out: clock_out ? new Date(clock_out) : null,
        status,
        marked_by: req.user.user_id,
      },
    });
    res.status(201).json({ success: true, message: "Attendance created successfully", attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const attendanceId = Number(req.params.id);
    const { clock_in, clock_out, status } = req.body;
    const attendance = await prisma.attendance.update({
      where: { attendance_id: attendanceId },
      data: {
        clock_in: clock_in ? new Date(clock_in) : undefined,
        clock_out: clock_out ? new Date(clock_out) : undefined,
        status,
      },
    });
    res.json({ success: true, message: "Attendance updated successfully", attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const attendanceId = Number(req.params.id);
    await prisma.attendance.delete({ where: { attendance_id: attendanceId } });
    res.json({ success: true, message: "Attendance deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAttendance, getAttendanceById, createAttendance, updateAttendance, deleteAttendance };
