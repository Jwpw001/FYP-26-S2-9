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
    getCasualAvailability,
    getShiftCapacity,
} = require("../controllers/shiftController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const {
    createShiftSchema,
    updateShiftSchema
} = require("../validators/shiftValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getShifts
);

router.get(
    "/capacity",
    verifyToken,
    allowRoles(ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN),
    getShiftCapacity
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getShiftById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    validate(createShiftSchema),
    createShift
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    validate(updateShiftSchema),
    updateShift
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    deleteShift
);

router.post("/generate-week",       verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN), generateWeeklySchedule);
router.post("/confirm-week",        verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN), confirmWeeklySchedule);
router.get("/casual-availability",  verifyToken, allowRoles(ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN), getCasualAvailability);

module.exports = router;
