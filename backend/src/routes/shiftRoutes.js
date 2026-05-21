const express = require("express");

const router = express.Router();

const {
    getShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift
} = require("../controllers/shiftController");

const validate = require("../middleware/validateMiddleware");

const {
    createShiftSchema,
    updateShiftSchema
} = require("../validators/shiftValidator");

router.get("/", getShifts);

router.get("/:id", getShiftById);

router.post(
    "/",
    validate(createShiftSchema),
    createShift
);

router.patch(
    "/:id",
    validate(updateShiftSchema),
    updateShift
);

router.delete("/:id", deleteShift);

module.exports = router;