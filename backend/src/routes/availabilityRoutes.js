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
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    createAvailabilitySchema,
    updateAvailabilitySchema
} = require("../validators/availabilityValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF, ROLES.COORDINATOR),
    getAvailability
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF, ROLES.COORDINATOR),
    getAvailabilityById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF, ROLES.COORDINATOR),
    validate(createAvailabilitySchema),
    createAvailability
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF, ROLES.COORDINATOR),
    validate(updateAvailabilitySchema),
    updateAvailability
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    deleteAvailability
);

module.exports = router;