const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { getStaffSkills, addStaffSkill, updateStaffSkill, removeStaffSkill, getBranchStaffSkills, getGlobalSkills } = require("../controllers/skillsController");

const CAN_READ  = [ROLES.BUSINESS_OWNER, ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN];
const CAN_WRITE = [ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN];

// Global skill suggestions (the 200 seeded skills)
router.get("/global",                       verifyToken, allowRoles(...CAN_READ, ROLES.REGULAR_STAFF), getGlobalSkills);

// Staff skills — BO can view, only managers can modify
router.get("/branch/:branch_id",            verifyToken, allowRoles(...CAN_READ),  getBranchStaffSkills);
router.get("/staff/:staff_id",              verifyToken, allowRoles(...CAN_READ),  getStaffSkills);
router.post("/staff/:staff_id",             verifyToken, allowRoles(...CAN_WRITE), addStaffSkill);
router.patch("/staff/:staff_id/:skill_id",  verifyToken, allowRoles(...CAN_WRITE), updateStaffSkill);
router.delete("/staff/:staff_id/:skill_id", verifyToken, allowRoles(...CAN_WRITE), removeStaffSkill);

module.exports = router;
