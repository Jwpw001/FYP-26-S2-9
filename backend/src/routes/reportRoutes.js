const express = require("express");
const router  = express.Router();

const { getReports, getReportById } = require("../controllers/reportController");

const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES       = require("../constants/roles");

const REPORT_ROLES = [ROLES.SYSTEM_ADMIN, ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR];

router.get("/",    verifyToken, allowRoles(...REPORT_ROLES), getReports);
router.get("/:id", verifyToken, allowRoles(...REPORT_ROLES), getReportById);

module.exports = router;