const express = require("express");

const router = express.Router();

const {
    getAvailability,
    getAvailabilityById,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    cancelOwnLeave,
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
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.SYSTEM_ADMIN
    ),
    getAvailability
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.SYSTEM_ADMIN
    ),
    getAvailabilityById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.SYSTEM_ADMIN
    ),
    validate(createAvailabilitySchema),
    createAvailability
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.SYSTEM_ADMIN
    ),
    validate(updateAvailabilitySchema),
    updateAvailability
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    deleteAvailability
);

// Staff cancel their own pending leave (does not require manager role)
router.delete(
    "/:id/cancel",
    verifyToken,
    allowRoles(
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    cancelOwnLeave
);

module.exports = router;
