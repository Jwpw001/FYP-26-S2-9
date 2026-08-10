const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  registerCasualWorker,
  getCasualWorkerStatus,
  getMyBranches,
  getPreferences,
  setPreferences,
  getMyAvailability,
  setMyAvailability,
  submitWeeklyAvailability,
  getPeriodAvailability,
  getPeriodAvailabilityHistory,
  setPeriodAvailability,
  getStandingAvailability,
  setStandingAvailability,
  setWeekAsStandingPattern,
  getManagerPool,
  autoAssignCasual,
  getPool,
  approveWorker,
  rejectWorker,
  getJoinCode,
  regenerateJoinCode,
} = require("../controllers/casualController");

// Public
router.post("/register", registerCasualWorker);

router.use(protect);

// Casual worker
router.get("/me",              getCasualWorkerStatus);
router.get("/my-branches",      getMyBranches);
router.get("/preferences",     getPreferences);
router.put("/preferences",     setPreferences);
router.get("/availability",        getMyAvailability);
router.put("/availability",        setMyAvailability);
router.post("/availability/submit", submitWeeklyAvailability);
router.get("/period-availability",              getPeriodAvailability);
router.get("/period-availability/history",      getPeriodAvailabilityHistory);
router.put("/period-availability",              setPeriodAvailability);
router.post("/period-availability/set-as-standing", setWeekAsStandingPattern);
router.get("/standing-availability",            getStandingAvailability);
router.put("/standing-availability",            setStandingAvailability);

// Manager
router.get("/manager/pool",        getManagerPool);
router.post("/manager/auto-assign", autoAssignCasual);

// Business Owner
router.get("/pool",                      getPool);
router.post("/pool/:id/approve",         approveWorker);
router.post("/pool/:id/reject",          rejectWorker);
router.get("/join-code",                 getJoinCode);
router.post("/join-code/regenerate",     regenerateJoinCode);

module.exports = router;
