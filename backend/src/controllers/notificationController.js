const prisma = require("../config/prisma");

// GET /api/notifications — returns only the requesting user's notifications
const getNotifications = async (req, res) => {
    try {
        // Support ?recipient_id=X from frontend, but always scope to the token user
        const recipientId = req.query.recipient_id
            ? Number(req.query.recipient_id)
            : req.user.user_id;

        const notifications = await prisma.notifications.findMany({
            where: { recipient_id: recipientId },
            orderBy: { created_at: "desc" }
        });

        res.json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getNotificationById = async (req, res) => {
    try {
        const notification = await prisma.notifications.findUnique({
            where: { notification_id: Number(req.params.id) }
        });
        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        res.json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/notifications — internal use (e.g. triggered on leave approve, shift publish)
const createNotification = async (req, res) => {
    try {
        const { recipient_id, title, message, type, related_entity, related_id } = req.body;

        const notification = await prisma.notifications.create({
            data: {
                recipient_id: Number(recipient_id),
                title,
                message,
                type,
                related_entity: related_entity || null,
                related_id: related_id || null
            }
        });

        res.status(201).json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/notifications/:id — mark single notification read/unread
const updateNotification = async (req, res) => {
    try {
        const { is_read } = req.body;
        const notification = await prisma.notifications.update({
            where: { notification_id: Number(req.params.id) },
            data: { is_read }
        });
        res.json({ success: true, notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/notifications — bulk mark all as read for a recipient
const markAllRead = async (req, res) => {
    try {
        const recipientId = req.body.recipient_id
            ? Number(req.body.recipient_id)
            : req.user.user_id;

        await prisma.notifications.updateMany({
            where: { recipient_id: recipientId },
            data: { is_read: true }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        await prisma.notifications.delete({
            where: { notification_id: Number(req.params.id) }
        });
        res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    markAllRead,
    deleteNotification
};
