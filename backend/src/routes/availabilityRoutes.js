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
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_COORDINATOR,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getAvailability
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_COORDINATOR,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getAvailabilityById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_COORDINATOR,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    validate(createAvailabilitySchema),
    createAvailability
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_COORDINATOR,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    validate(updateAvailabilitySchema),
    updateAvailability
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    deleteAvailability
);

module.exports = router;