const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { getMyBranches, createBranch, updateBranch, deleteBranch, getAllStaff, getAllManagers, getBranchStaff, getBranchManagers, getManagerDetail, updateManagerDetail, deleteManagerDetail, getStaffDetail, getStaffKpi, updateStaffDetail, deleteStaffDetail, getMyBusiness, updateMyBusinessPlan, getBranchSkills, createBranchSkill, updateBranchSkill, deleteBranchSkill, getBusinessStats, getRoleTemplates, upsertRoleTemplates, getBusinessSkills, createBusinessSkill, deleteBusinessSkill, getBusinessSkillsForAssignment, getBranchSkillsSummary, getBusinessSettings, updateBusinessSettings, updateAllocationPrefs, getBranchSettings, updateBranchSettings, updateBranchAllocationPrefs } = require("../controllers/businessOwnerController");

router.use(protect);

router.get("/info",                              getMyBusiness);
router.patch("/plan",       allowRoles(ROLES.BUSINESS_OWNER), updateMyBusinessPlan);
router.get("/stats",                             getBusinessStats);
router.get("/branches",                           getMyBranches);
router.post("/branches",                          createBranch);
router.patch("/branches/:branch_id",              updateBranch);
router.delete("/branches/:branch_id",             deleteBranch);
router.get("/staff",                             getAllStaff);
router.get("/managers",                          getAllManagers);
router.get("/branches/:branch_id/staff",          getBranchStaff);
router.get("/branches/:branch_id/managers",       getBranchManagers);
router.get("/managers/:user_id",                 getManagerDetail);
router.patch("/managers/:user_id",               updateManagerDetail);
router.delete("/managers/:user_id",              deleteManagerDetail);
router.get("/staff/:staff_id",                   getStaffDetail);
router.get("/staff/:staff_id/kpi",               getStaffKpi);
router.patch("/staff/:staff_id",                 updateStaffDetail);
router.delete("/staff/:staff_id",                deleteStaffDetail);
router.get("/settings",                                getBusinessSettings);
router.put("/settings",                                updateBusinessSettings);
router.put("/settings/allocation",                     updateAllocationPrefs);
router.get("/skills",                                  getBusinessSkills);
router.get("/skills/assignable",                       getBusinessSkillsForAssignment);
router.get("/branch-skills-summary",                   getBranchSkillsSummary);
router.post("/skills",                                createBusinessSkill);
router.delete("/skills/:skill_id",                    deleteBusinessSkill);
router.get("/branches/:branch_id/skills",              getBranchSkills);
router.post("/branches/:branch_id/skills",             createBranchSkill);
router.patch("/branches/:branch_id/skills/:skill_id",  updateBranchSkill);
router.delete("/branches/:branch_id/skills/:skill_id", deleteBranchSkill);
router.get("/branches/:branch_id/role-templates",      getRoleTemplates);
router.put("/branches/:branch_id/role-templates",      upsertRoleTemplates);
router.get("/branches/:branch_id/settings",            getBranchSettings);
router.put("/branches/:branch_id/settings",            updateBranchSettings);
router.put("/branches/:branch_id/settings/allocation", updateBranchAllocationPrefs);

module.exports = router;

