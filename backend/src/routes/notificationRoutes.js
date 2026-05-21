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

const {
    createNotificationSchema,
    updateNotificationSchema
} = require("../validators/notificationValidator");

router.get("/", getNotifications);

router.get("/:id", getNotificationById);

router.post(
    "/",
    validate(createNotificationSchema),
    createNotification
);

router.patch(
    "/:id",
    validate(updateNotificationSchema),
    updateNotification
);

router.delete("/:id", deleteNotification);

module.exports = router;