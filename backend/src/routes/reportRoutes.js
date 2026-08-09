const express = require("express");
const router = express.Router();
const { getReports, createReport } = require("../controllers/reportController");
const { getWorkingHoursReport } = require("../controllers/workingHoursReportController");
const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { createReportSchema } = require("../validators/reportValidator");

const allowed = allowRoles(
  ROLES.SYSTEM_ADMIN,
  ROLES.BUSINESS_OWNER,
  ROLES.BRANCH_MANAGER
);

router.get("/working-hours", verifyToken, allowed, getWorkingHoursReport);
router.get("/",  verifyToken, allowed, getReports);
router.post("/", verifyToken, allowed, validate(createReportSchema), createReport);

module.exports = router;
