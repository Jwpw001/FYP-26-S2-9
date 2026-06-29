const express = require("express");
const router  = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { getProjects, createProject, updateProject, deleteProject, assignStaff, removeStaff, getCapacity } = require("../controllers/projectController");

const MGR = [ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN];

router.get("/",                          verifyToken, allowRoles(...MGR, ROLES.REGULAR_STAFF), getProjects);
router.post("/",                         verifyToken, allowRoles(...MGR), createProject);
router.patch("/:id",                     verifyToken, allowRoles(...MGR), updateProject);
router.delete("/:id",                    verifyToken, allowRoles(...MGR), deleteProject);
router.post("/:id/assign",               verifyToken, allowRoles(...MGR), assignStaff);
router.delete("/:id/assign/:staffId",    verifyToken, allowRoles(...MGR), removeStaff);
router.get("/capacity",                  verifyToken, allowRoles(...MGR), getCapacity);

module.exports = router;
