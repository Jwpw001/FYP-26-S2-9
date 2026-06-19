const express = require("express");

const router = express.Router();

const {
    getAttendance,
    getAttendanceById,
    createAttendance,
    updateAttendance,
    deleteAttendance
} = require("../controllers/attendanceController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    createAttendanceSchema,
    updateAttendanceSchema
} = require("../validators/attendanceValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF
    ),
    getAttendance
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF
    ),
    getAttendanceById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF
    ),
    validate(createAttendanceSchema),
    createAttendance
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF
    ),
    validate(updateAttendanceSchema),
    updateAttendance
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    deleteAttendance
);

module.exports = router;
