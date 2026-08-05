const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { getMyBranches, createBranch, updateBranch, deleteBranch, getAllStaff, getAllManagers, getBranchStaff, getBranchManagers, getManagerDetail, updateManagerDetail, deleteManagerDetail, getStaffDetail, getStaffKpi, updateStaffDetail, deleteStaffDetail, getMyBusiness, updateMyBusinessPlan, getBranchSkills, createBranchSkill, updateBranchSkill, deleteBranchSkill, getBusinessStats, getRoleTemplates, upsertRoleTemplates, getBusinessSkills, createBusinessSkill, deleteBusinessSkill, getBusinessSkillsForAssignment, getBranchSkillsSummary, getBusinessSettings, updateBusinessSettings, updateAllocationPrefs, getBranchSettings, updateBranchSettings, updateBranchAllocationPrefs } = require("../controllers/businessOwnerController");

router.use(protect);

const OWNER_ONLY   = allowRoles(ROLES.BUSINESS_OWNER);
const OWNER_OR_MGR = allowRoles(ROLES.BUSINESS_OWNER, ROLES.BRANCH_MANAGER);

router.get("/info",                              OWNER_ONLY, getMyBusiness);
router.patch("/plan",                            OWNER_ONLY, updateMyBusinessPlan);
router.get("/stats",                             OWNER_ONLY, getBusinessStats);
router.get("/branches",                           OWNER_ONLY, getMyBranches);
router.post("/branches",                          OWNER_ONLY, createBranch);
router.patch("/branches/:branch_id",              OWNER_ONLY, updateBranch);
router.delete("/branches/:branch_id",             OWNER_ONLY, deleteBranch);
router.get("/staff",                             OWNER_ONLY, getAllStaff);
router.get("/managers",                          OWNER_ONLY, getAllManagers);
router.get("/branches/:branch_id/staff",          OWNER_ONLY, getBranchStaff);
router.get("/branches/:branch_id/managers",       OWNER_ONLY, getBranchManagers);
router.get("/managers/:user_id",                 OWNER_ONLY, getManagerDetail);
router.patch("/managers/:user_id",               OWNER_ONLY, updateManagerDetail);
router.delete("/managers/:user_id",              OWNER_ONLY, deleteManagerDetail);
router.get("/staff/:staff_id",                   OWNER_ONLY, getStaffDetail);
router.get("/staff/:staff_id/kpi",               OWNER_ONLY, getStaffKpi);
router.patch("/staff/:staff_id",                 OWNER_ONLY, updateStaffDetail);
router.delete("/staff/:staff_id",                OWNER_ONLY, deleteStaffDetail);
router.get("/settings",                                OWNER_OR_MGR, getBusinessSettings);
router.put("/settings",                                OWNER_ONLY, updateBusinessSettings);
router.put("/settings/allocation",                     OWNER_OR_MGR, updateAllocationPrefs);
router.get("/skills",                                  OWNER_OR_MGR, getBusinessSkills);
router.get("/skills/assignable",                       OWNER_OR_MGR, getBusinessSkillsForAssignment);
router.get("/branch-skills-summary",                   OWNER_OR_MGR, getBranchSkillsSummary);
router.post("/skills",                                OWNER_OR_MGR, createBusinessSkill);
router.delete("/skills/:skill_id",                    OWNER_OR_MGR, deleteBusinessSkill);
router.get("/branches/:branch_id/skills",              OWNER_OR_MGR, getBranchSkills);
router.post("/branches/:branch_id/skills",             OWNER_OR_MGR, createBranchSkill);
router.patch("/branches/:branch_id/skills/:skill_id",  OWNER_OR_MGR, updateBranchSkill);
router.delete("/branches/:branch_id/skills/:skill_id", OWNER_OR_MGR, deleteBranchSkill);
router.get("/branches/:branch_id/role-templates",      OWNER_OR_MGR, getRoleTemplates);
router.put("/branches/:branch_id/role-templates",      OWNER_OR_MGR, upsertRoleTemplates);
router.get("/branches/:branch_id/settings",            OWNER_OR_MGR, getBranchSettings);
router.put("/branches/:branch_id/settings",            OWNER_OR_MGR, updateBranchSettings);
router.put("/branches/:branch_id/settings/allocation", OWNER_OR_MGR, updateBranchAllocationPrefs);

module.exports = router;

