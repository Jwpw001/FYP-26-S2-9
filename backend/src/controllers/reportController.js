const getReports = (req, res) => {
    res.json({
        success: true,
        message: "Get reports controller working"
    });
};

module.exports = {
    getReports
};