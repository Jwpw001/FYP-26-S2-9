const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const {
  getBusinessSkills, createBusinessSkill, updateBusinessSkill, deleteBusinessSkill,
  getStaffSkills, addStaffSkill, removeStaffSkill,
} = require("../controllers/skillsController");

const CAN_MANAGE = [ROLES.BUSINESS_OWNER, ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN];

// Business skill library
router.get("/business",             verifyToken, allowRoles(...CAN_MANAGE), getBusinessSkills);
router.post("/business",            verifyToken, allowRoles(...CAN_MANAGE), createBusinessSkill);
router.patch("/business/:skill_id", verifyToken, allowRoles(...CAN_MANAGE), updateBusinessSkill);
router.delete("/business/:skill_id",verifyToken, allowRoles(...CAN_MANAGE), deleteBusinessSkill);

// Staff skills
router.get("/staff/:staff_id",                   verifyToken, allowRoles(...CAN_MANAGE), getStaffSkills);
router.post("/staff/:staff_id",                  verifyToken, allowRoles(...CAN_MANAGE), addStaffSkill);
router.delete("/staff/:staff_id/:skill_id",      verifyToken, allowRoles(...CAN_MANAGE), removeStaffSkill);

module.exports = router;
