const prisma = require("../config/prisma");
const { getOutletId } = require("../utils/getOutletId");

// Helper — get outlet_id for the requesting user
async function getOutletIdForUser(userId, role) {
  return getOutletId(userId, role);
}

const getShifts = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id, req.user.role);
    if (!outletId) {
      return res.status(400).json({ success: false, message: "No outlet linked to this account. Ask your system admin to set up your outlet." });
    }
    const where = { outlet_id: outletId };

    const shifts = await prisma.shifts.findMany({
      where,
      include: {
        outlets: true,
        shift_roles: {
          include: {
            skills: { select: { skill_id: true, name: true } },
            shift_assignments: {
              include: {
                staff: {
                  include: {
                    users: { select: { user_id: true, full_name: true, email: true } }
                  }
                },
                attendance: true
              }
            }
          }
        }
      },
      orderBy: { shift_date: "asc" }
    });

    res.json({ success: true, shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getShiftById = async (req, res) => {
  try {
    const shift = await prisma.shifts.findUnique({
      where: { shift_id: Number(req.params.id) },
      include: {
        outlets: true,
        shift_roles: {
          include: {
            skills: { select: { skill_id: true, name: true } },
            shift_assignments: {
              include: {
                staff: {
                  include: {
                    users: { select: { user_id: true, full_name: true, email: true } }
                  }
                },
                attendance: true
              }
            }
          }
        }
      }
    });

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    res.json({ success: true, shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    const { outlet_id, title, shift_date, start_time, end_time, status, roles } = req.body;

    let resolvedOutletId = outlet_id ? Number(outlet_id) : await getOutletId(req.user.user_id, req.user.role);

    if (!resolvedOutletId) {
      return res.status(400).json({ success: false, message: "outlet_id is required" });
    }

    const shift = await prisma.shifts.create({
      data: {
        outlet_id: resolvedOutletId,
        title: title || null,
        shift_date: new Date(shift_date),
        start_time: new Date(`1970-01-01T${start_time}:00Z`),
        end_time: new Date(`1970-01-01T${end_time}:00Z`),
        status: status || "draft",
        created_by: req.user.user_id
      }
    });

    if (Array.isArray(roles) && roles.length > 0) {
      const validRoles = roles.filter(r => r.role_name?.trim());
      if (validRoles.length > 0) {
        await prisma.shift_roles.createMany({
          data: validRoles.map(r => ({
            shift_id: shift.shift_id,
            role_name: r.role_name.trim(),
            skill_id: r.skill_id ? Number(r.skill_id) : null,
            headcount: Number(r.headcount) || 1
          }))
        });
      }
    }

    const shiftWithRoles = await prisma.shifts.findUnique({
      where: { shift_id: shift.shift_id },
      include: {
        outlets: true,
        shift_roles: { include: { skills: true } }
      }
    });

    res.status(201).json({ success: true, message: "Shift created successfully", shift: shiftWithRoles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShift = async (req, res) => {
  try {
    const { title, shift_date, start_time, end_time, status } = req.body;

    const shift = await prisma.shifts.update({
      where: { shift_id: Number(req.params.id) },
      data: {
        title,
        shift_date: shift_date ? new Date(shift_date) : undefined,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : undefined,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : undefined,
        status
      }
    });

    res.json({ success: true, message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    await prisma.shifts.delete({ where: { shift_id: Number(req.params.id) } });
    res.json({ success: true, message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getShifts, getShiftById, createShift, updateShift, deleteShift };
