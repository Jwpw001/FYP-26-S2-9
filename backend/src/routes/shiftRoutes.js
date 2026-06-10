const express = require("express");
const router = express.Router();
const ROLES = require("../constants/roles");
const { getShifts, getShiftById, createShift, updateShift, deleteShift } = require("../controllers/shiftController");
const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { createShiftSchema, updateShiftSchema } = require("../validators/shiftValidator");
const prisma = require("../config/prisma");

const ALL_STAFF = [ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR, ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF, ROLES.KREWBY_CASUAL_WORKER];

router.get("/", verifyToken, allowRoles(...ALL_STAFF), getShifts);
router.get("/:id", verifyToken, allowRoles(...ALL_STAFF), getShiftById);
router.post("/", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), validate(createShiftSchema), createShift);
router.patch("/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), validate(updateShiftSchema), updateShift);
router.delete("/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), deleteShift);

// PATCH /api/shifts/assignments/:id/acknowledge
router.patch("/assignments/:id/acknowledge",
  verifyToken,
  async (req, res) => {
    try {
      const data = await prisma.shift_assignments.update({
        where: { assignment_id: Number(req.params.id) },
        data: { acknowledged: true },
      });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/shifts/swap-requests
router.get("/swap-requests",
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.user.user_id;
      const staff = await prisma.staff.findFirst({ where: { user_id: userId } });
      const data = await prisma.swap_requests.findMany({
        where: { requester_id: staff?.staff_id },
        orderBy: { swap_id: "desc" },
      });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/shifts/swap-requests
router.post("/swap-requests",
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.user.user_id;
      const staff = await prisma.staff.findFirst({ where: { user_id: userId } });
      const { request_type, reason, requester_assign } = req.body;
      const data = await prisma.swap_requests.create({
        data: {
          requester_id: staff?.staff_id || userId,
          requester_assign: Number(requester_assign) || 1,
          request_type,
          reason,
          status: "pending",
        },
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
