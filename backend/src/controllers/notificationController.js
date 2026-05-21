const getNotifications = (req, res) => {
    res.json({
        success: true,
        message: "Get all notifications"
    });
};

const getNotificationById = (req, res) => {
    res.json({
        success: true,
        message: "Get notification by ID",
        notificationId: req.params.id
    });
};

const createNotification = (req, res) => {
    res.status(201).json({
        success: true,
        message: "Create notification",
        data: req.body
    });
};

const updateNotification = (req, res) => {
    res.json({
        success: true,
        message: "Update notification",
        notificationId: req.params.id,
        data: req.body
    });
};

const deleteNotification = (req, res) => {
    res.json({
        success: true,
        message: "Delete notification",
        notificationId: req.params.id
    });
};

module.exports = {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification
};