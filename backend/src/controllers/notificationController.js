const prisma = require("../config/prisma");
const { parsePagination } = require("../utils/pagination");

const getNotifications = async (req, res) => {
    try {
        const where = { recipient_id: req.dbUser.user_id };

        const { requested, page, limit, skip } = parsePagination(req.query);
        if (!requested) {
            // No ?page/?limit supplied — preserve the pre-pagination response shape unchanged so
            // existing frontend calls keep working without a coordinated update.
            const notifications = await prisma.notifications.findMany({
                where,
                orderBy: { notification_id: "asc" }
            });
            return res.json({ success: true, notifications });
        }

        const [data, total] = await Promise.all([
            prisma.notifications.findMany({ where, orderBy: { notification_id: "asc" }, skip, take: limit }),
            prisma.notifications.count({ where }),
        ]);
        res.json({ success: true, data, page, limit, total });
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

        if (!notification || notification.recipient_id !== req.dbUser.user_id) {
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
            recipient_id,
            title,
            message,
            type,
            related_entity,
            related_id
        } = req.body;

        const recipient = await prisma.users.findUnique({
            where: { user_id: recipient_id }
        });

        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: "Recipient not found"
            });
        }

        const notification = await prisma.notifications.create({
            data: {
                recipient_id,
                title,
                message,
                type,
                related_entity: related_entity || null,
                related_id: related_id ?? null
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

        const existing = await prisma.notifications.findUnique({
            where: { notification_id: notificationId }
        });

        if (!existing || existing.recipient_id !== req.dbUser.user_id) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

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

        const existing = await prisma.notifications.findUnique({
            where: { notification_id: notificationId }
        });

        if (!existing || existing.recipient_id !== req.dbUser.user_id) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

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
