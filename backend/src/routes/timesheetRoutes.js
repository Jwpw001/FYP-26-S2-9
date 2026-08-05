const express = require("express");
const multer = require("multer");

const router = express.Router();

const ROLES = require("../constants/roles");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { submitReport, getEvidenceUrl } = require("../controllers/timesheetController");

const ALL_SHIFT_ROLES = [
  ROLES.BRANCH_MANAGER,
  ROLES.SYSTEM_ADMIN,
  ROLES.BUSINESS_OWNER,
  ROLES.REGULAR_STAFF,
  ROLES.BRANCH_CASUAL_STAFF,
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post("/", verifyToken, allowRoles(...ALL_SHIFT_ROLES), upload.single("evidence"), submitReport);
router.get("/:id/evidence", verifyToken, allowRoles(...ALL_SHIFT_ROLES), getEvidenceUrl);

module.exports = router;
