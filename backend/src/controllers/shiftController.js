const getShifts = (req, res) => {
    res.json({
        success: true,
        message: "Get shifts controller working"
    });
};

module.exports = {
    getShifts
};