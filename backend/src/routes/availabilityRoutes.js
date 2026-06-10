const express = require("express");
const router = express.Router();
const { getAvailability, getAvailabilityById, createAvailability, updateAvailability, deleteAvailability } = require("../controllers/availabilityController");
const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { createAvailabilitySchema, updateAvailabilitySchema } = require("../validators/availabilityValidator");
const prisma = require("../config/prisma");

const ALL = [ROLES.OUTLET_MANAGER, ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF, ROLES.KREWBY_COORDINATOR, ROLES.KREWBY_CASUAL_WORKER];

router.get("/", verifyToken, allowRoles(...ALL), getAvailability);
router.get("/:id", verifyToken, allowRoles(...ALL), getAvailabilityById);
router.post("/", verifyToken, allowRoles(...ALL), validate(createAvailabilitySchema), createAvailability);
router.patch("/:id", verifyToken, allowRoles(...ALL), validate(updateAvailabilitySchema), updateAvailability);
router.delete("/:id", verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR), deleteAvailability);

// POST /api/availability/casual - outlet casual staff weekly availability
router.post("/casual",
  verifyToken,
  allowRoles(ROLES.OUTLET_CASUAL_STAFF),
  async (req, res) => {
    try {
      const userId = req.user.user_id;
      const staff = await prisma.staff.findFirst({ where: { user_id: userId, is_active: true } });
      if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
      const { week_start_date, slots } = req.body;
      for (const slot of slots) {
        await prisma.casual_availability.upsert({
          where: {
            staff_id_week_start_date_day_of_week: {
              staff_id: staff.staff_id,
              week_start_date: new Date(week_start_date),
              day_of_week: slot.day_of_week,
            },
          },
          update: { available_from: slot.available_from, available_to: slot.available_to },
          create: {
            staff_id: staff.staff_id,
            week_start_date: new Date(week_start_date),
            day_of_week: slot.day_of_week,
            available_from: slot.available_from,
            available_to: slot.available_to,
          },
        });
      }
      res.json({ success: true, message: "Availability saved" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
