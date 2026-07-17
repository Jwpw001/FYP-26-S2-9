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
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getNotifications
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getNotificationById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    validate(createNotificationSchema),
    createNotification
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    validate(updateNotificationSchema),
    updateNotification
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    deleteNotification
);

module.exports = router;
