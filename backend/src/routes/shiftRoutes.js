const express = require("express");
const router = express.Router();
const ROLES = require("../constants/roles");
const { getShifts, getShiftById, createShift, updateShift, deleteShift } = require("../controllers/shiftController");
const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { createShiftSchema, updateShiftSchema } = require("../validators/shiftValidator");
const prisma = require("../config/prisma");

const { getOutletId } = require("../utils/getOutletId");

const ALL_STAFF = [
  ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR,
  ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF, ROLES.KREWBY_CASUAL_WORKER
];

// ─── Core shift CRUD ─────────────────────────────────────────────────────────
router.get("/", verifyToken, allowRoles(...ALL_STAFF), getShifts);
router.post("/", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), validate(createShiftSchema), createShift);
router.patch("/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), validate(updateShiftSchema), updateShift);
router.delete("/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), deleteShift);

// ─── Skills (for dropdowns) ───────────────────────────────────────────────────
// GET /api/skills — also reachable at /api/account/skills but this is the canonical path
router.get("/skills/list", verifyToken, async (req, res) => {
  try {
    const skills = await prisma.skills.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, skills });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Shift Roles ─────────────────────────────────────────────────────────────
// GET /api/shifts/shift-roles?shift_id=X
router.get("/shift-roles/list", verifyToken, allowRoles(...ALL_STAFF), async (req, res) => {
  try {
    const shift_id = Number(req.query.shift_id);
    if (!shift_id) return res.status(400).json({ success: false, message: "shift_id required" });
    const shift_roles = await prisma.shift_roles.findMany({
      where: { shift_id },
      include: { skills: true }
    });
    res.json({ success: true, shift_roles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts/shift-roles — create a role on an existing shift
router.post("/shift-roles/add", verifyToken, allowRoles(ROLES.OUTLET_MANAGER), async (req, res) => {
  try {
    const { shift_id, role_name, skill_id, headcount } = req.body;
    const role = await prisma.shift_roles.create({
      data: {
        shift_id: Number(shift_id),
        role_name,
        skill_id: skill_id ? Number(skill_id) : null,
        headcount: Number(headcount) || 1
      },
      include: { skills: true }
    });
    res.status(201).json({ success: true, role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/shifts/shift-roles/:id
router.delete("/shift-roles/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER), async (req, res) => {
  try {
    await prisma.shift_roles.delete({ where: { role_id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Shift Assignments ────────────────────────────────────────────────────────
// GET /api/shifts/shift-assignments?shift_id=X
router.get("/shift-assignments/list", verifyToken, allowRoles(...ALL_STAFF), async (req, res) => {
  try {
    const shift_id = Number(req.query.shift_id);
    if (!shift_id) return res.status(400).json({ success: false, message: "shift_id required" });
    const shift_assignments = await prisma.shift_assignments.findMany({
      where: { shift_id },
      include: {
        staff: {
          include: {
            users: { select: { user_id: true, full_name: true, email: true } }
          }
        },
        shift_roles: { select: { role_id: true, role_name: true, skill_id: true } },
        attendance: true
      }
    });
    res.json({ success: true, shift_assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts/shift-assignments/assign
// Body: { shift_id, role_id, staff_id, status, acknowledged }
router.post("/shift-assignments/assign", verifyToken, allowRoles(ROLES.OUTLET_MANAGER), async (req, res) => {
  try {
    const { shift_id, role_id, staff_id, status, acknowledged } = req.body;
    const assignment = await prisma.shift_assignments.create({
      data: {
        shift_id: Number(shift_id),
        role_id: Number(role_id),
        staff_id: Number(staff_id),
        status: status || "assigned",
        acknowledged: acknowledged || false
      },
      include: {
        staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } }
      }
    });
    res.status(201).json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/shifts/shift-assignments/:id
router.delete("/shift-assignments/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER), async (req, res) => {
  try {
    await prisma.shift_assignments.delete({
      where: { assignment_id: Number(req.params.id) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Acknowledge ──────────────────────────────────────────────────────────────
// PATCH /api/shifts/assignments/:id/acknowledge
router.patch("/assignments/:id/acknowledge", verifyToken, async (req, res) => {
  try {
    const data = await prisma.shift_assignments.update({
      where: { assignment_id: Number(req.params.id) },
      data: { acknowledged: true }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Swap / Replacement Requests ─────────────────────────────────────────────
// GET /api/shifts/swap-requests
router.get("/swap-requests", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const staff = await prisma.staff.findFirst({ where: { user_id: userId } });
    // Managers see all swap requests for their outlet; staff see only their own
    let data;
    if (req.user.role === "outlet_manager") {
      const outletId = await getOutletId(userId, req.user.role);
      // Get all staff_ids in this outlet, then find their requests
      const outletStaff = outletId
        ? await prisma.staff.findMany({ where: { outlet_id: outletId }, select: { staff_id: true } })
        : [];
      const staffIds = outletStaff.map(s => s.staff_id);
      data = await prisma.swap_requests.findMany({
        where: { requester_id: { in: staffIds } },
        orderBy: { swap_id: "desc" }
      });
    } else {
      data = await prisma.swap_requests.findMany({
        where: { requester_id: staff?.staff_id },
        orderBy: { swap_id: "desc" }
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shifts/swap-requests
router.post("/swap-requests", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const staff = await prisma.staff.findFirst({ where: { user_id: userId } });
    const { request_type, reason, requester_assign } = req.body;

    if (!requester_assign) {
      return res.status(400).json({ success: false, message: "requester_assign is required" });
    }

    const data = await prisma.swap_requests.create({
      data: {
        requester_id: staff?.staff_id || userId,
        requester_assign: Number(requester_assign),
        request_type,
        reason,
        status: "pending"
      }
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/shifts/swap-requests/:id — manager approve/reject
router.patch("/swap-requests/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER), async (req, res) => {
  try {
    const { status } = req.body;
    const data = await prisma.swap_requests.update({
      where: { swap_id: Number(req.params.id) },
      data: {
        status,
        manager_id: req.user.user_id,
        manager_decided_at: new Date()
      }
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id", verifyToken, allowRoles(...ALL_STAFF), getShiftById);

module.exports = router;
