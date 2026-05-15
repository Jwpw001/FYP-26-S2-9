const getStaff = (req, res) => {
    res.json({
        success: true,
        message: "Get staff controller working"
    });
};

module.exports = {
    getStaff
};