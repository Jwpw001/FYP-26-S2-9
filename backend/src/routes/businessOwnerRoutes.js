const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { getMyOutlets, createOutlet, updateOutlet, deleteOutlet, getAllStaff, getAllManagers, getOutletStaff, getOutletManagers, getManagerDetail, updateManagerDetail, deleteManagerDetail, getStaffDetail, getStaffKpi, updateStaffDetail, deleteStaffDetail, getMyBusiness, getOutletSkills, createOutletSkill, updateOutletSkill, deleteOutletSkill, getBusinessStats, getRoleTemplates, upsertRoleTemplates, getBusinessSkills, createBusinessSkill, deleteBusinessSkill, getBusinessSkillsForAssignment, getBranchSkillsSummary, getBusinessSettings, updateBusinessSettings, updateAllocationPrefs, getOutletSettings, updateOutletSettings, updateOutletAllocationPrefs } = require("../controllers/businessOwnerController");

router.use(protect);

router.get("/info",                              getMyBusiness);
router.get("/stats",                             getBusinessStats);
router.get("/outlets",                           getMyOutlets);
router.post("/outlets",                          createOutlet);
router.patch("/outlets/:outlet_id",              updateOutlet);
router.delete("/outlets/:outlet_id",             deleteOutlet);
router.get("/staff",                             getAllStaff);
router.get("/managers",                          getAllManagers);
router.get("/outlets/:outlet_id/staff",          getOutletStaff);
router.get("/outlets/:outlet_id/managers",       getOutletManagers);
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
router.get("/outlets/:outlet_id/skills",              getOutletSkills);
router.post("/outlets/:outlet_id/skills",             createOutletSkill);
router.patch("/outlets/:outlet_id/skills/:skill_id",  updateOutletSkill);
router.delete("/outlets/:outlet_id/skills/:skill_id", deleteOutletSkill);
router.get("/outlets/:outlet_id/role-templates",      getRoleTemplates);
router.put("/outlets/:outlet_id/role-templates",      upsertRoleTemplates);
router.get("/outlets/:outlet_id/settings",            getOutletSettings);
router.put("/outlets/:outlet_id/settings",            updateOutletSettings);
router.put("/outlets/:outlet_id/settings/allocation", updateOutletAllocationPrefs);

module.exports = router;

