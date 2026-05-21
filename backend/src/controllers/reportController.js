const { getReportsService } = require("../services/reportService");

const getReports = (req, res) => {

    const result = getReportsService();

    res.json(result);

};

module.exports = {
    getReports
};