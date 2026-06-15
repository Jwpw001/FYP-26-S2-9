const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { getMyOutlets, createOutlet, getMyBusiness, getOutletSkills, createOutletSkill, deleteOutletSkill, getBusinessStats } = require("../controllers/businessOwnerController");

router.use(protect);

router.get("/info",                              getMyBusiness);
router.get("/stats",                             getBusinessStats);
router.get("/outlets",                           getMyOutlets);
router.post("/outlets",                          createOutlet);
router.get("/outlets/:outlet_id/skills",         getOutletSkills);
router.post("/outlets/:outlet_id/skills",        createOutletSkill);
router.delete("/outlets/:outlet_id/skills/:skill_id", deleteOutletSkill);

module.exports = router;
