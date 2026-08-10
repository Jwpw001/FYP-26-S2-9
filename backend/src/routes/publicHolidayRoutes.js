const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { getPublicHolidays } = require("../controllers/publicHolidayController");

router.get("/", verifyToken, allowRoles(ROLES.BUSINESS_OWNER, ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN), getPublicHolidays);

module.exports = router;
