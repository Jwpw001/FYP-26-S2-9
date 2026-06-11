const prisma = require("../config/prisma");
const { getOutletId } = require("../utils/getOutletId");

const getAvailability = async (req, res) => {
    try {
        const { role, user_id } = req.user;
        let where = {};

        if (role === "outlet_manager") {
            // Filter to only show leave requests for staff in this manager's outlet
            const outletId = await getOutletId(user_id, role);
            if (outletId) {
                const outletStaff = await prisma.staff.findMany({
                    where: { outlet_id: outletId },
                    select: { staff_id: true }
                });
                where = { staff_id: { in: outletStaff.map(s => s.staff_id) } };
            }
        } else if (role === "regular_staff" || role === "outlet_casual_staff") {
            // Staff only see their own requests
            const staffRecord = await prisma.staff.findFirst({ where: { user_id } });
            where = { staff_id: staffRecord?.staff_id };
        }

        const availability = await prisma.availability.findMany({
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
                staff: {
                    include: {
                        users: { select: { user_id: true, full_name: true } }
                    }
                }
            },
            orderBy: { request_id: "desc" }
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
            status
        } = req.body;

        // Resolve staff_id from token if not supplied by frontend
        let resolvedStaffId = staff_id;
        if (!resolvedStaffId) {
            const staffRecord = await prisma.staff.findFirst({
                where: { user_id: req.user.user_id }
            });
            resolvedStaffId = staffRecord?.staff_id;
        }
        if (!resolvedStaffId) {
            return res.status(400).json({ success: false, message: "Staff record not found for this user" });
        }

        const availability = await prisma.availability.create({
            data: {
                staff_id: resolvedStaffId,
                leave_type,
                start_date: new Date(start_date),
                end_date: new Date(end_date),
                reason: reason || null,
                status: status || "pending"
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
                reviewed_by: status === "approved" || status === "rejected"
                    ? req.user.user_id
                    : (reviewed_by || undefined),
                reviewed_at: (status === "approved" || status === "rejected")
                    ? new Date()
                    : (reviewed_at ? new Date(reviewed_at) : undefined)
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