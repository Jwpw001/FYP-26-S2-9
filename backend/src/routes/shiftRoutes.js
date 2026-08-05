const express = require("express");

const router = express.Router();

const ROLES = require("../constants/roles");

const {
    getShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift,
    generateWeeklySchedule,
    confirmWeeklySchedule,
    rescheduleStaff,
    reviewWeeklySchedule,
    previewRoster,
} = require("../controllers/shiftController");

const {
    getShiftTasks,
    createTask,
    updateTask,
    deleteTask,
    assignStaff,
    unassignStaff,
    getMyTasks,
    getStaffRoster,
    validateAssignment,
} = require("../controllers/taskController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const {
    createShiftSchema,
    updateShiftSchema
} = require("../validators/shiftValidator");

const ALL_SHIFT_ROLES = [
    ROLES.BRANCH_MANAGER,
    ROLES.SYSTEM_ADMIN,
    ROLES.REGULAR_STAFF,
    ROLES.BRANCH_CASUAL_STAFF,
];

const MANAGER_ONLY = [ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN];

// ── Static routes first (must come before any /:param routes) ─────────────────

router.get("/me/tasks",     verifyToken, allowRoles(...ALL_SHIFT_ROLES), getMyTasks);
router.post("/generate-week",  verifyToken, allowRoles(...MANAGER_ONLY), generateWeeklySchedule);
router.post("/confirm-week",   verifyToken, allowRoles(...MANAGER_ONLY), confirmWeeklySchedule);
router.post("/reschedule-staff", verifyToken, allowRoles(...MANAGER_ONLY), rescheduleStaff);
router.post("/review-schedule",  verifyToken, allowRoles(...MANAGER_ONLY), reviewWeeklySchedule);
router.get("/roster-preview",    verifyToken, allowRoles(...MANAGER_ONLY), previewRoster);

// ── Shifts ─────────────────────────────────────────────────────────────────────

router.get("/",    verifyToken, allowRoles(...ALL_SHIFT_ROLES), getShifts);
router.post("/",   verifyToken, allowRoles(...MANAGER_ONLY), validate(createShiftSchema), createShift);
router.get("/:id", verifyToken, allowRoles(...ALL_SHIFT_ROLES), getShiftById);
router.patch("/:id", verifyToken, allowRoles(...MANAGER_ONLY), validate(updateShiftSchema), updateShift);
router.delete("/:id", verifyToken, allowRoles(...MANAGER_ONLY), deleteShift);

// ── Tasks (manager CRUD) ───────────────────────────────────────────────────────

router.patch("/tasks/:taskId",         verifyToken, allowRoles(...MANAGER_ONLY),    updateTask);
router.delete("/tasks/:taskId",        verifyToken, allowRoles(...MANAGER_ONLY),    deleteTask);
router.post("/tasks/:taskId/assign",   verifyToken, allowRoles(...MANAGER_ONLY),    assignStaff);
router.delete("/tasks/:taskId/assign", verifyToken, allowRoles(...MANAGER_ONLY),    unassignStaff);
router.get("/:shiftId/tasks",          verifyToken, allowRoles(...ALL_SHIFT_ROLES), getShiftTasks);
router.post("/:shiftId/tasks",         verifyToken, allowRoles(...MANAGER_ONLY),    createTask);
router.get("/:shiftId/staff-roster",   verifyToken, allowRoles(...MANAGER_ONLY),    getStaffRoster);
router.post("/tasks/:taskId/validate-assignment", verifyToken, allowRoles(...MANAGER_ONLY), validateAssignment);

module.exports = router;
