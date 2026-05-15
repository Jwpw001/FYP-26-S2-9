const getRecommendations = (req, res) => {
    res.json({
        success: true,
        message: "Get recommendations controller working"
    });
};

module.exports = {
    getRecommendations
};