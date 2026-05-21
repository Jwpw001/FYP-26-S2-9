const { getAttendanceService } = require("../services/attendanceService");

const getAttendance = (req, res) => {

    const result = getAttendanceService();

    res.json(result);

};

module.exports = {
    getAttendance
};