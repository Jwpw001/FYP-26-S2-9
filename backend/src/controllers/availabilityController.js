const getAvailability = (req, res) => {
    res.json({
        success: true,
        message: "Get availability controller working"
    });
};

module.exports = {
    getAvailability
};