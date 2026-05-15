const getAttendance = (req, res) => {
    res.json({
        success: true,
        message: "Get attendance controller working"
    });
};

module.exports = {
    getAttendance
};