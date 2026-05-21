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
    allowRoles(ROLES.MANAGER, ROLES.STAFF),
    getAttendance
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF),
    getAttendanceById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF),
    validate(createAttendanceSchema),
    createAttendance
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF),
    validate(updateAttendanceSchema),
    updateAttendance
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    deleteAttendance
);

module.exports = router;