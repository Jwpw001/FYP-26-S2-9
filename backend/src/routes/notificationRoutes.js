const express = require("express");

const router = express.Router();

const {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification,
    notifyMyManagers,
    notifyMyStaff
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
        ROLES.BRANCH_CASUAL_STAFF
    ),
    getNotifications
);

// Static routes before /:id — otherwise Express would match these as an :id param.
router.post(
    "/notify-my-managers",
    verifyToken,
    allowRoles(ROLES.REGULAR_STAFF, ROLES.BRANCH_CASUAL_STAFF),
    notifyMyManagers
);

router.post(
    "/notify-my-staff",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN),
    notifyMyStaff
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF
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
