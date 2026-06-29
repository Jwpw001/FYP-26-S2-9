const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const {
  getServices, createService, updateService, deleteService,
  getBookings, createBooking, updateBooking, deleteBooking,
  autoAssign, detectGaps, getMyAppointments,
} = require("../controllers/bookingController");

const MGR   = [ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN];
const STAFF = [ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF, ...MGR];

// Services
router.get("/services",          verifyToken, allowRoles(...MGR),   getServices);
router.post("/services",         verifyToken, allowRoles(...MGR),   createService);
router.patch("/services/:id",    verifyToken, allowRoles(...MGR),   updateService);
router.delete("/services/:id",   verifyToken, allowRoles(...MGR),   deleteService);

// Bookings
router.get("/",                  verifyToken, allowRoles(...MGR),   getBookings);
router.post("/",                 verifyToken, allowRoles(...MGR),   createBooking);
router.patch("/:id",             verifyToken, allowRoles(...MGR),   updateBooking);
router.delete("/:id",            verifyToken, allowRoles(...MGR),   deleteBooking);

// AI assign + gap detection
router.post("/auto-assign",      verifyToken, allowRoles(...MGR),   autoAssign);
router.get("/gaps",              verifyToken, allowRoles(...MGR),   detectGaps);

// Staff view
router.get("/my",                verifyToken, allowRoles(...STAFF), getMyAppointments);

module.exports = router;
