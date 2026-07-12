const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { getStaffSkills, addStaffSkill, updateStaffSkill, removeStaffSkill, getOutletStaffSkills } = require("../controllers/skillsController");

const CAN_MANAGE = [ROLES.BUSINESS_OWNER, ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN];

// Staff skills
router.get("/outlet/:outlet_id",             verifyToken, allowRoles(...CAN_MANAGE), getOutletStaffSkills);
router.get("/staff/:staff_id",              verifyToken, allowRoles(...CAN_MANAGE), getStaffSkills);
router.post("/staff/:staff_id",              verifyToken, allowRoles(...CAN_MANAGE), addStaffSkill);
router.patch("/staff/:staff_id/:skill_id",   verifyToken, allowRoles(...CAN_MANAGE), updateStaffSkill);
router.delete("/staff/:staff_id/:skill_id",  verifyToken, allowRoles(...CAN_MANAGE), removeStaffSkill);

module.exports = router;
