const { getRecommendationsService } = require("../services/recommendationService");

const getRecommendations = (req, res) => {

    const result = getRecommendationsService();

    res.json(result);

};

module.exports = {
    getRecommendations
};