const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { submitTimesheet, getMyTimesheets, getAllTimesheets, reviewTimesheet, bulkApprove } = require("../controllers/timesheetController");

const MGR   = [ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN];
const STAFF = [ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF];

router.post("/",              verifyToken, allowRoles(...STAFF, ...MGR), submitTimesheet);
router.get("/my",             verifyToken, allowRoles(...STAFF, ...MGR), getMyTimesheets);
router.get("/",               verifyToken, allowRoles(...MGR),           getAllTimesheets);
router.patch("/:id/review",   verifyToken, allowRoles(...MGR),           reviewTimesheet);
router.post("/bulk-approve",  verifyToken, allowRoles(...MGR),           bulkApprove);

module.exports = router;
