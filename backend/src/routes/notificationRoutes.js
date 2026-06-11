const express = require("express");
const router  = express.Router();

const {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    markAllRead,
    deleteNotification
} = require("../controllers/notificationController");

const verifyToken = require("../middleware/authMiddleware");
const allowRoles  = require("../middleware/roleMiddleware");
const ROLES       = require("../constants/roles");

const ALL_ROLES = [
    ROLES.OUTLET_MANAGER,
    ROLES.KREWBY_COORDINATOR,
    ROLES.REGULAR_STAFF,
    ROLES.OUTLET_CASUAL_STAFF,
    ROLES.KREWBY_CASUAL_WORKER,
    ROLES.SYSTEM_ADMIN
];

// GET /api/notifications — user's own notifications
router.get("/", verifyToken, allowRoles(...ALL_ROLES), getNotifications);

// GET /api/notifications/:id
router.get("/:id", verifyToken, allowRoles(...ALL_ROLES), getNotificationById);

// POST /api/notifications — create (internal / admin use)
router.post("/", verifyToken, createNotification);

// PATCH /api/notifications — bulk mark all read (no :id)
router.patch("/", verifyToken, allowRoles(...ALL_ROLES), markAllRead);

// PATCH /api/notifications/:id — mark single read/unread
router.patch("/:id", verifyToken, allowRoles(...ALL_ROLES), updateNotification);

// DELETE /api/notifications/:id
router.delete("/:id", verifyToken, allowRoles(...ALL_ROLES), deleteNotification);

module.exports = router;
