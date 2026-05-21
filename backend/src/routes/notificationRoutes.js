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
        ROLES.MANAGER,
        ROLES.STAFF,
        ROLES.COORDINATOR
    ),
    getNotifications
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.MANAGER,
        ROLES.STAFF,
        ROLES.COORDINATOR
    ),
    getNotificationById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.MANAGER,
        ROLES.COORDINATOR
    ),
    validate(createNotificationSchema),
    createNotification
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.MANAGER,
        ROLES.COORDINATOR
    ),
    validate(updateNotificationSchema),
    updateNotification
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.MANAGER
    ),
    deleteNotification
);

module.exports = router;