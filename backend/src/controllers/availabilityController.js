const prisma = require("../config/prisma");

const getAvailability = async (req, res) => {
    try {
        const availability = await prisma.availability.findMany({
            include: {
                users: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        res.json({
            success: true,
            availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAvailabilityById = async (req, res) => {
    try {
        const requestId = Number(req.params.id);

        const availability = await prisma.availability.findUnique({
            where: {
                request_id: requestId
            },
            include: {
                users: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        if (!availability) {
            return res.status(404).json({
                success: false,
                message: "Availability request not found"
            });
        }

        res.json({
            success: true,
            availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createAvailability = async (req, res) => {
    try {
        const {
            staff_id,
            leave_type,
            start_date,
            end_date,
            reason,
            status,
            reviewed_by,
            reviewed_at
        } = req.body;

        const availability = await prisma.availability.create({
            data: {
                staff_id,
                leave_type,
                start_date: new Date(start_date),
                end_date: new Date(end_date),
                reason,
                status,
                reviewed_by,
                reviewed_at: reviewed_at ? new Date(reviewed_at) : null
            }
        });

        res.status(201).json({
            success: true,
            message: "Availability request created successfully",
            availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateAvailability = async (req, res) => {
    try {
        const requestId = Number(req.params.id);

        const {
            leave_type,
            start_date,
            end_date,
            reason,
            status,
            reviewed_by,
            reviewed_at
        } = req.body;

        const availability = await prisma.availability.update({
            where: {
                request_id: requestId
            },
            data: {
                leave_type,
                start_date: start_date ? new Date(start_date) : undefined,
                end_date: end_date ? new Date(end_date) : undefined,
                reason,
                status,
                reviewed_by,
                reviewed_at: reviewed_at ? new Date(reviewed_at) : undefined
            }
        });

        res.json({
            success: true,
            message: "Availability request updated successfully",
            availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteAvailability = async (req, res) => {
    try {
        const requestId = Number(req.params.id);

        await prisma.availability.delete({
            where: {
                request_id: requestId
            }
        });

        res.json({
            success: true,
            message: "Availability request deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAvailability,
    getAvailabilityById,
    createAvailability,
    updateAvailability,
    deleteAvailability
};