const express = require("express");

const router = express.Router();

const {
    getAvailability,
    getAvailabilityById,
    createAvailability,
    updateAvailability,
    deleteAvailability
} = require("../controllers/availabilityController");

const validate = require("../middleware/validateMiddleware");

const {
    createAvailabilitySchema,
    updateAvailabilitySchema
} = require("../validators/availabilityValidator");

router.get("/", getAvailability);

router.get("/:id", getAvailabilityById);

router.post(
    "/",
    validate(createAvailabilitySchema),
    createAvailability
);

router.patch(
    "/:id",
    validate(updateAvailabilitySchema),
    updateAvailability
);

router.delete("/:id", deleteAvailability);

module.exports = router;