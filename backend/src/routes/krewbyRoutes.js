const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const {
  getRequests, getRequestByIdController, createRequestController, updateRequestController,
  getMatchesController, assignWorkerController,
  getWorkersController, getWorkerByIdController,
  getMyAssignmentsController, confirmAssignmentController, declineAssignmentController,
  clockInController, clockOutController,
  submitAvailabilityController, rateWorkerController,
} = require("../controllers/krewbyController");

// ─── Requests ─────────────────────────────────────────────────
router.get("/requests",
  verifyToken,
  allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR),
  getRequests
);

router.get("/requests/:id",
  verifyToken,
  allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR),
  getRequestByIdController
);

router.post("/requests",
  verifyToken,
  allowRoles(ROLES.OUTLET_MANAGER),
  createRequestController
);

router.patch("/requests/:id",
  verifyToken,
  allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR),
  updateRequestController
);

router.get("/requests/:id/matches",
  verifyToken,
  allowRoles(ROLES.KREWBY_COORDINATOR),
  getMatchesController
);

router.post("/requests/:id/assign",
  verifyToken,
  allowRoles(ROLES.KREWBY_COORDINATOR),
  assignWorkerController
);

// ─── Workers ──────────────────────────────────────────────────
router.get("/workers",
  verifyToken,
  allowRoles(ROLES.KREWBY_COORDINATOR, ROLES.SYSTEM_ADMIN),
  getWorkersController
);

router.get("/workers/:id",
  verifyToken,
  allowRoles(ROLES.KREWBY_COORDINATOR, ROLES.SYSTEM_ADMIN),
  getWorkerByIdController
);

router.post("/workers/:id/rate",
  verifyToken,
  allowRoles(ROLES.OUTLET_MANAGER),
  rateWorkerController
);

// ─── My Assignments (Krewby Worker) ───────────────────────────
router.get("/my-assignments",
  verifyToken,
  allowRoles(ROLES.KREWBY_CASUAL_WORKER),
  getMyAssignmentsController
);

router.patch("/assignments/:id/confirm",
  verifyToken,
  allowRoles(ROLES.KREWBY_CASUAL_WORKER),
  confirmAssignmentController
);

router.patch("/assignments/:id/decline",
  verifyToken,
  allowRoles(ROLES.KREWBY_CASUAL_WORKER),
  declineAssignmentController
);

router.post("/assignments/:id/clock-in",
  verifyToken,
  allowRoles(ROLES.KREWBY_CASUAL_WORKER),
  clockInController
);

router.post("/assignments/:id/clock-out",
  verifyToken,
  allowRoles(ROLES.KREWBY_CASUAL_WORKER),
  clockOutController
);

// ─── Availability ──────────────────────────────────────────────
router.post("/availability",
  verifyToken,
  allowRoles(ROLES.KREWBY_CASUAL_WORKER),
  submitAvailabilityController
);

module.exports = router;
