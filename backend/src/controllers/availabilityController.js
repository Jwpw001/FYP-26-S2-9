const { getAvailabilityService } = require("../services/availabilityService");

const getAvailability = (req, res) => {

    const result = getAvailabilityService();

    res.json(result);

};

module.exports = {
    getAvailability
};