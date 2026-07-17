const express = require("express");
const router = express.Router();
const { recommendShiftStaff } = require("../controllers/recommendationController");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

router.post(
  "/shift/:shift_id",
  verifyToken,
  allowRoles(ROLES.SYSTEM_ADMIN, ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN),
  recommendShiftStaff
);

module.exports = router;

