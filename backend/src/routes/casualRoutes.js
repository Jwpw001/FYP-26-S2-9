const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  registerCasualWorker,
  getCasualWorkerStatus,
  browseRequests,
  applyToRequest,
  withdrawApplication,
  getMyApplications,
  createRequest,
  listManagerRequests,
  getRequestDetail,
  confirmApplicant,
  cancelRequest,
  aiRecommend,
  getPool,
  approveWorker,
  rejectWorker,
  getJoinCode,
  regenerateJoinCode,
} = require("../controllers/casualController");

// ── Public ──────────────────────────────────────────────────────────────────
router.post("/register", registerCasualWorker);

// ── Casual Worker ────────────────────────────────────────────────────────────
router.get("/me",                        protect, getCasualWorkerStatus);
router.get("/requests",                  protect, browseRequests);
router.post("/requests/:id/apply",       protect, applyToRequest);
router.delete("/requests/:id/apply",     protect, withdrawApplication);
router.get("/my-applications",           protect, getMyApplications);

// ── Manager ──────────────────────────────────────────────────────────────────
router.post("/manager/requests",                            protect, createRequest);
router.get("/manager/requests",                             protect, listManagerRequests);
router.get("/manager/requests/:id",                         protect, getRequestDetail);
router.post("/manager/requests/:id/confirm/:application_id", protect, confirmApplicant);
router.post("/manager/requests/:id/cancel",                 protect, cancelRequest);
router.post("/manager/requests/:id/ai-recommend",           protect, aiRecommend);

// ── Business Owner ────────────────────────────────────────────────────────────
router.get("/pool",                    protect, getPool);
router.post("/pool/:id/approve",       protect, approveWorker);
router.post("/pool/:id/reject",        protect, rejectWorker);
router.get("/join-code",               protect, getJoinCode);
router.post("/join-code/regenerate",   protect, regenerateJoinCode);

module.exports = router;
