const express = require("express");
const router  = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  getTasks, createTask, updateTask, deleteTask,
  getEpics, createEpic, updateEpic, deleteEpic,
  getSprints, createSprint, updateSprint, deleteSprint,
  getPortfolio, getProjectMembers, createKrewbyRequest,
} = require("../controllers/flexibleController");

router.use(protect);

// Portfolio (BO + manager)
router.get("/portfolio", getPortfolio);

// Project-scoped
router.get("/projects/:project_id/tasks",   getTasks);
router.post("/projects/:project_id/tasks",  createTask);
router.patch("/tasks/:task_id",             updateTask);
router.delete("/tasks/:task_id",            deleteTask);

router.get("/projects/:project_id/epics",   getEpics);
router.post("/projects/:project_id/epics",  createEpic);
router.patch("/epics/:epic_id",             updateEpic);
router.delete("/epics/:epic_id",            deleteEpic);

router.get("/projects/:project_id/sprints", getSprints);
router.post("/projects/:project_id/sprints",createSprint);
router.patch("/sprints/:sprint_id",         updateSprint);
router.delete("/sprints/:sprint_id",        deleteSprint);

router.get("/projects/:project_id/members", getProjectMembers);

// Krewby worker requests
router.post("/krewby-requests", createKrewbyRequest);

module.exports = router;
