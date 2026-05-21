const { getNotificationsService } = require("../services/notificationService");

const getNotifications = (req, res) => {

    const result = getNotificationsService();

    res.json(result);

};

module.exports = {
    getNotifications
};