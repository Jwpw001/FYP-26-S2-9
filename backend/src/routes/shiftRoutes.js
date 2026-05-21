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

router.get("/", getShifts);

router.get("/:id", getShiftById);

router.post(
    "/",
    verifyToken,
    allowRoles(
    ROLES.MANAGER,
    ROLES.COORDINATOR
),
    validate(createShiftSchema),
    createShift
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles("manager", "coordinator"),
    validate(updateShiftSchema),
    updateShift
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles("manager", "coordinator"),
    deleteShift
);

module.exports = router;