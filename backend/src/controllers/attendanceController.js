const prisma = require("../config/prisma");

const getAttendance = async (req, res) => {
    try {
        const attendance = await prisma.attendance.findMany({
            orderBy: {
                attendance_id: "asc"
            }
        });

        res.json({
            success: true,
            attendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAttendanceById = async (req, res) => {
    try {
        const attendanceId = Number(req.params.id);

        const attendance = await prisma.attendance.findUnique({
            where: {
                attendance_id: attendanceId
            }
        });

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found"
            });
        }

        res.json({
            success: true,
            attendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createAttendance = async (req, res) => {
    try {
        const {
            user_id,
            shift_id,
            check_in_time,
            check_out_time,
            status
        } = req.body;

        const attendance = await prisma.attendance.create({
            data: {
                user_id,
                shift_id,
                check_in_time: new Date(check_in_time),
                check_out_time: check_out_time ? new Date(check_out_time) : null,
                status
            }
        });

        res.status(201).json({
            success: true,
            message: "Attendance created successfully",
            attendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateAttendance = async (req, res) => {
    try {
        const attendanceId = Number(req.params.id);

        const {
            check_in_time,
            check_out_time,
            status
        } = req.body;

        const attendance = await prisma.attendance.update({
            where: {
                attendance_id: attendanceId
            },
            data: {
                check_in_time: check_in_time ? new Date(check_in_time) : undefined,
                check_out_time: check_out_time ? new Date(check_out_time) : undefined,
                status
            }
        });

        res.json({
            success: true,
            message: "Attendance updated successfully",
            attendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteAttendance = async (req, res) => {
    try {
        const attendanceId = Number(req.params.id);

        await prisma.attendance.delete({
            where: {
                attendance_id: attendanceId
            }
        });

        res.json({
            success: true,
            message: "Attendance deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAttendance,
    getAttendanceById,
    createAttendance,
    updateAttendance,
    deleteAttendance
};