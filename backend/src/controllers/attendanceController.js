const prisma = require("../config/prisma");

const getAttendance = async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      include: {
        shift_assignments: {
          include: {
            staff: {
              include: {
                users: { select: { user_id: true, full_name: true, email: true } }
              }
            },
            shift_roles: { select: { role_id: true, role_name: true } }
          }
        },
        users: { select: { user_id: true, full_name: true, email: true } }
      },
      orderBy: { marked_at: "desc" }
    });
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAttendanceById = async (req, res) => {
  try {
    const attendance = await prisma.attendance.findUnique({
      where: { attendance_id: Number(req.params.id) },
      include: {
        shift_assignments: {
          include: {
            staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } }
          }
        }
      }
    });
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/attendance
// Body: { assignment_id, status }
const createAttendance = async (req, res) => {
  try {
    const { assignment_id, status } = req.body;

    if (!assignment_id) {
      return res.status(400).json({ success: false, message: "assignment_id is required" });
    }

    // Upsert: if a record already exists for this assignment, update it
    const existing = await prisma.attendance.findFirst({
      where: { assignment_id: Number(assignment_id) }
    });

    let attendance;
    if (existing) {
      attendance = await prisma.attendance.update({
        where: { attendance_id: existing.attendance_id },
        data: {
          status,
          marked_by: req.user.user_id,
          marked_at: new Date()
        }
      });
    } else {
      attendance = await prisma.attendance.create({
        data: {
          assignment_id: Number(assignment_id),
          status,
          marked_by: req.user.user_id,
          marked_at: new Date()
        }
      });
    }

    res.status(201).json({ success: true, message: "Attendance saved successfully", attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/attendance/:id
// Body: { status }
const updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    const attendance = await prisma.attendance.update({
      where: { attendance_id: Number(req.params.id) },
      data: {
        status,
        marked_by: req.user.user_id,
        marked_at: new Date()
      }
    });
    res.json({ success: true, message: "Attendance updated successfully", attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    await prisma.attendance.delete({
      where: { attendance_id: Number(req.params.id) }
    });
    res.json({ success: true, message: "Attendance deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
};
