const getNotifications = (req, res) => {
    res.json({
        success: true,
        message: "Get notifications controller working"
    });
};

module.exports = {
    getNotifications
};