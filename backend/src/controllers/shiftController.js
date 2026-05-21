const { getShiftsService } = require("../services/shiftService");

const getShifts = (req, res) => {

    const result = getShiftsService();

    res.json(result);

};

module.exports = {
    getShifts
};