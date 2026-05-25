const prisma = require("../config/prisma");

const getNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notifications.findMany({
            orderBy: {
                notification_id: "asc"
            }
        });

        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getNotificationById = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);

        const notification = await prisma.notifications.findUnique({
            where: {
                notification_id: notificationId
            }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        res.json({
            success: true,
            notification
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createNotification = async (req, res) => {
    try {
        const {
            user_id,
            title,
            message,
            type
        } = req.body;

        const notification = await prisma.notifications.create({
            data: {
                user_id,
                title,
                message,
                type
            }
        });

        res.status(201).json({
            success: true,
            message: "Notification created successfully",
            notification
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateNotification = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);

        const {
            title,
            message,
            type,
            is_read
        } = req.body;

        const notification = await prisma.notifications.update({
            where: {
                notification_id: notificationId
            },
            data: {
                title,
                message,
                type,
                is_read
            }
        });

        res.json({
            success: true,
            message: "Notification updated successfully",
            notification
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);

        await prisma.notifications.delete({
            where: {
                notification_id: notificationId
            }
        });

        res.json({
            success: true,
            message: "Notification deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification
};