const { getStaffService } = require("../services/staffService");

const getStaff = (req, res) => {

    const result = getStaffService();

    res.json(result);

};

module.exports = {
    getStaff
};