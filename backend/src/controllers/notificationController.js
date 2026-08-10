const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { parsePagination } = require("../utils/pagination");
const { notifyUser, notifyUsers, getBranchManagerUserIds } = require("../utils/notify");

const sendServerError = require("../utils/sendServerError");
async function getCallerBranchId(userId) {
    const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
    if (s?.branch_id) return s.branch_id;
    const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
    return mgr?.branch_id || null;
}

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
        sendServerError(res, error, req);
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
        sendServerError(res, error, req);
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

        const notification = await notifyUser({
            recipientId: recipient_id,
            title,
            message,
            type,
            relatedEntity: related_entity || null,
            relatedId: related_id ?? null
        });

        res.status(201).json({
            success: true,
            message: "Notification created successfully",
            notification
        });
    } catch (error) {
        sendServerError(res, error, req);
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
        sendServerError(res, error, req);
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
        sendServerError(res, error, req);
    }
};

// POST /api/notifications/notify-my-managers — self-service roles only (regular_staff/
// casual_staff), for notifying THEIR OWN branch's managers about something they just did
// (leave/off-day/swap request, shift acknowledgment, etc). Recipients are always resolved
// server-side from the caller's own staff record — a client never gets to supply who receives
// this, otherwise any authenticated user could spam arbitrary notifications at will.
const notifyMyManagers = async (req, res) => {
    try {
        const { type, title, message, related_entity, related_id } = req.body;
        if (!type || !title) {
            return res.status(400).json({ success: false, message: "type and title are required." });
        }

        const staff = await prisma.staff.findFirst({
            where: { user_id: req.user.user_id },
            select: { branch_id: true },
        });
        if (!staff?.branch_id) {
            // No branch on record (e.g. a pool-based casual worker) — nothing to notify, not an error.
            return res.json({ success: true, notified: 0 });
        }

        const managerIds = await getBranchManagerUserIds(staff.branch_id);
        await notifyUsers(managerIds, {
            type,
            title,
            message,
            relatedEntity: related_entity || null,
            relatedId: related_id ?? null,
        });

        res.json({ success: true, notified: managerIds.length });
    } catch (error) {
        sendServerError(res, error, req);
    }
};

// POST /api/notifications/notify-my-staff — manager/admin only, for notifying one specific
// staff member about a decision (leave/off-day/swap/report approved or rejected). The target is
// verified to be within the caller's own branch server-side before anything is sent — a manager
// can't use this to message someone else's staff.
const notifyMyStaff = async (req, res) => {
    try {
        const { recipient_user_id, type, title, message, related_entity, related_id } = req.body;
        if (!recipient_user_id || !type || !title) {
            return res.status(400).json({ success: false, message: "recipient_user_id, type and title are required." });
        }

        const targetStaff = await prisma.staff.findFirst({
            where: { user_id: Number(recipient_user_id) },
            select: { branch_id: true },
        });
        if (!targetStaff) {
            return res.status(404).json({ success: false, message: "Recipient not found." });
        }

        const callerBranchId = await getCallerBranchId(req.user.user_id);
        if (callerBranchId && targetStaff.branch_id !== callerBranchId) {
            return res.status(403).json({ success: false, message: "That staff member is not in your branch." });
        }

        const notification = await notifyUser({
            recipientId: Number(recipient_user_id),
            type,
            title,
            message,
            relatedEntity: related_entity || null,
            relatedId: related_id ?? null,
        });

        res.json({ success: true, notification });
    } catch (error) {
        sendServerError(res, error, req);
    }
};

module.exports = {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification,
    notifyMyManagers,
    notifyMyStaff,
};
