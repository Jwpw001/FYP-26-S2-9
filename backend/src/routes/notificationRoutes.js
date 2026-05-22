const express = require("express");

const router = express.Router();

const {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification
} = require("../controllers/notificationController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    createNotificationSchema,
    updateNotificationSchema
} = require("../validators/notificationValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getNotifications
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getNotificationById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    validate(createNotificationSchema),
    createNotification
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    validate(updateNotificationSchema),
    updateNotification
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    deleteNotification
);

module.exports = router;