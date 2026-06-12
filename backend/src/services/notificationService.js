const prisma = require("../config/prisma");

const getNotifications = async (userId, limit = 50) => {
  try {
    const notifications = await prisma.notifications.findMany({
      where: {
        recipient_id: parseInt(userId)
      },
      include: {
        users: {
          select: {
            user_id: true,
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: "desc"
      },
      take: parseInt(limit)
    });

    return {
      success: true,
      notifications
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const createNotification = async (notificationData) => {
  try {
    const notification = await prisma.notifications.create({
      data: {
        recipient_id: notificationData.recipient_id,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        related_entity: notificationData.related_entity,
        related_id: notificationData.related_id,
        is_read: notificationData.is_read !== undefined ? notificationData.is_read : false
      },
      include: {
        users: {
          select: {
            user_id: true,
            full_name: true,
            email: true
          }
        }
      }
    });

    return {
      success: true,
      message: "Notification created successfully",
      notification
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  getNotifications,
  createNotification
};