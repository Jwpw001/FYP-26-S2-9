const prisma = require("../config/prisma");

const getStaff = async (req, res) => {
    try {
        // Find the requesting user's staff record to get their outlet
        const myRecord = await prisma.staff.findFirst({
            where: { user_id: req.user.user_id }
        });

        const where = myRecord?.outlet_id
            ? { outlet_id: myRecord.outlet_id }
            : {};

        const staff = await prisma.staff.findMany({
            where,
            include: {
                users: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true,
                        role: true
                    }
                },
                outlets: true
            }
        });

        res.json({ success: true, staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getStaffById = async (req, res) => {
    try {
        const staffId = Number(req.params.id);

        const staff = await prisma.staff.findUnique({
            where: {
                staff_id: staffId
            },
            include: {
                users: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true,
                        role: true
                    }
                },
                outlets: true
            }
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found"
            });
        }

        res.json({
            success: true,
            staff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createStaff = async (req, res) => {
    try {
        const {
            user_id,
            outlet_id,
            staff_type,
            default_work_days,
            hired_at,
            is_active
        } = req.body;

        const staff = await prisma.staff.create({
            data: {
                user_id,
                outlet_id,
                staff_type,
                default_work_days,
                hired_at: hired_at ? new Date(hired_at) : null,
                is_active
            }
        });

        res.status(201).json({
            success: true,
            message: "Staff created successfully",
            staff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateStaff = async (req, res) => {
    try {
        const staffId = Number(req.params.id);

        const {
            outlet_id,
            staff_type,
            default_work_days,
            hired_at,
            is_active
        } = req.body;

        const staff = await prisma.staff.update({
            where: {
                staff_id: staffId
            },
            data: {
                outlet_id,
                staff_type,
                default_work_days,
                hired_at: hired_at ? new Date(hired_at) : undefined,
                is_active
            }
        });

        res.json({
            success: true,
            message: "Staff updated successfully",
            staff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteStaff = async (req, res) => {
    try {
        const staffId = Number(req.params.id);

        await prisma.staff.delete({
            where: {
                staff_id: staffId
            }
        });

        res.json({
            success: true,
            message: "Staff deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff
};