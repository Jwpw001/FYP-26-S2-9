const prisma = require("../config/prisma");
const { getOutletId } = require("../utils/getOutletId");

const getStaff = async (req, res) => {
    try {
        const outletId = await getOutletId(req.user.user_id, req.user.role);
        if (!outletId) {
            return res.status(400).json({ success: false, message: "No outlet linked to this account. Ask your system admin to set up your outlet." });
        }
        const where = { outlet_id: outletId };

        const staff = await prisma.staff.findMany({
            where,
            include: {
                users: {
                    select: { user_id: true, full_name: true, email: true, role: true }
                },
                outlets: true,
                user_skill_tags: {
                    include: { skills: { select: { skill_id: true, name: true } } }
                }
            }
        });

        res.json({ success: true, staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getStaffById = async (req, res) => {
    try {
        const staff = await prisma.staff.findUnique({
            where: { staff_id: Number(req.params.id) },
            include: {
                users: {
                    select: { user_id: true, full_name: true, email: true, role: true }
                },
                outlets: true,
                user_skill_tags: {
                    include: { skills: { select: { skill_id: true, name: true } } }
                }
            }
        });

        if (!staff) {
            return res.status(404).json({ success: false, message: "Staff not found" });
        }

        res.json({ success: true, staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/staff
// Body: { full_name, email, staff_type, hired_at, skill_ids[], role }
const createStaff = async (req, res) => {
    try {
        const { full_name, email, staff_type, hired_at, skill_ids, role } = req.body;

        // Get manager's outlet
        const outletId = await getOutletId(req.user.user_id, req.user.role);

        if (!outletId) {
            return res.status(400).json({ success: false, message: "Manager outlet not found" });
        }

        // Check email not already taken
        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ success: false, message: "Email already in use" });
        }

        // Determine role string
        const userRole = role || (staff_type === "regular" ? "regular_staff" : "outlet_casual_staff");

        // Create user account (no password — auth is email-only)
        const newUser = await prisma.users.create({
            data: {
                full_name,
                email,
                username: email.split("@")[0],
                role: userRole,
                is_active: true,
            }
        });

        // Create staff record linked to manager's outlet
        const staff = await prisma.staff.create({
            data: {
                user_id: newUser.user_id,
                outlet_id: outletId,
                staff_type,
                hired_at: hired_at ? new Date(hired_at) : null,
                is_active: true,
            }
        });

        // Assign skill tags if provided
        if (Array.isArray(skill_ids) && skill_ids.length > 0) {
            await prisma.user_skill_tags.createMany({
                data: skill_ids.map(skill_id => ({
                    user_id: newUser.user_id,
                    skill_id: Number(skill_id),
                })),
                skipDuplicates: true,
            });
        }

        res.status(201).json({
            success: true,
            message: "Staff created successfully",
            staff: { ...staff, users: newUser }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateStaff = async (req, res) => {
    try {
        const staffId = Number(req.params.id);
        const { full_name, email, staff_type, hired_at, is_active, skill_ids } = req.body;

        // Get current staff to find user_id
        const current = await prisma.staff.findUnique({ where: { staff_id: staffId } });
        if (!current) {
            return res.status(404).json({ success: false, message: "Staff not found" });
        }

        // Update user fields if provided
        if (full_name || email) {
            await prisma.users.update({
                where: { user_id: current.user_id },
                data: {
                    full_name: full_name || undefined,
                    email: email || undefined,
                }
            });
        }

        // Update staff record
        const staff = await prisma.staff.update({
            where: { staff_id: staffId },
            data: {
                staff_type: staff_type || undefined,
                hired_at: hired_at ? new Date(hired_at) : undefined,
                is_active: is_active !== undefined ? is_active : undefined,
            }
        });

        // Update skill tags if provided
        if (Array.isArray(skill_ids)) {
            await prisma.user_skill_tags.deleteMany({ where: { user_id: current.user_id } });
            if (skill_ids.length > 0) {
                await prisma.user_skill_tags.createMany({
                    data: skill_ids.map(skill_id => ({
                        user_id: current.user_id,
                        skill_id: Number(skill_id),
                    })),
                    skipDuplicates: true,
                });
            }
        }

        res.json({ success: true, message: "Staff updated successfully", staff });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteStaff = async (req, res) => {
    try {
        await prisma.staff.delete({ where: { staff_id: Number(req.params.id) } });
        res.json({ success: true, message: "Staff deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getStaff, getStaffById, createStaff, updateStaff, deleteStaff };
