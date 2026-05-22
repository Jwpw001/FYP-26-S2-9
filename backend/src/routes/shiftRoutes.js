const express = require("express");

const router = express.Router();

const ROLES = require("../constants/roles");

const {
    getShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift
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
    allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR, ROLES.STAFF),
    getShifts
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR, ROLES.STAFF),
    getShiftById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR),
    validate(createShiftSchema),
    createShift
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR),
    validate(updateShiftSchema),
    updateShift
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.OUTLET_MANAGER, ROLES.KREWBY_COORDINATOR),
    deleteShift
);

module.exports = router;