const getAttendance = (req, res) => {

    res.json({
        success: true,
        message: "Get all attendance"
    });

};

const getAttendanceById = (req, res) => {

    res.json({
        success: true,
        message: "Get attendance by ID",
        attendanceId: req.params.id
    });

};

const createAttendance = (req, res) => {

    res.status(201).json({
        success: true,
        message: "Create attendance",
        data: req.body
    });

};

const updateAttendance = (req, res) => {

    res.json({
        success: true,
        message: "Update attendance",
        attendanceId: req.params.id,
        data: req.body
    });

};

const deleteAttendance = (req, res) => {

    res.json({
        success: true,
        message: "Delete attendance",
        attendanceId: req.params.id
    });

};

module.exports = {
    getAttendance,
    getAttendanceById,
    createAttendance,
    updateAttendance,
    deleteAttendance
};