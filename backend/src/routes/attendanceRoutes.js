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

const {
    createAttendanceSchema,
    updateAttendanceSchema
} = require("../validators/attendanceValidator");

router.get("/", getAttendance);

router.get("/:id", getAttendanceById);

router.post(
    "/",
    validate(createAttendanceSchema),
    createAttendance
);

router.patch(
    "/:id",
    validate(updateAttendanceSchema),
    updateAttendance
);

router.delete("/:id", deleteAttendance);

module.exports = router;