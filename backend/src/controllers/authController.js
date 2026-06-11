const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");
const supabaseAdmin = require("../config/supabaseAdmin");

const login = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await prisma.users.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account not found. Please contact your administrator."
            });
        }

        const token = generateToken({
            user_id: user.user_id,
            email: user.email,
            role: user.role
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const register = async (req, res) => {
    return res.status(403).json({
        success: false,
        message: "Registration is disabled. Please contact administrator."
    });
};

const forgotPassword = async (req, res) => {
    return res.json({
        success: true,
        message: "Forgot password endpoint working"
    });
};

const resetPassword = async (req, res) => {
    return res.json({
        success: true,
        message: "Reset password endpoint working"
    });
};

// Used by managers to create staff accounts (bypasses email domain restrictions)
const createStaffAccount = async (req, res) => {
    try {
        const { full_name, username, email, password, role, outlet_id, staff_type, default_work_days, hired_at, skill_ids } = req.body;

        if (!email || !password || !full_name || !username) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        // Check if user already exists in our users table
        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "A user with this email already exists." });
        }

        // Create Supabase Auth account using admin (bypasses email validation)
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // skip email confirmation
            user_metadata: { full_name },
        });

        if (authErr) {
            return res.status(400).json({ success: false, message: authErr.message });
        }

        // Insert into users table
        const newUser = await prisma.users.create({
            data: { full_name, username, email, role, is_active: true },
        });

        // Insert staff record
        await prisma.staff.create({
            data: {
                user_id: newUser.user_id,
                outlet_id: Number(outlet_id),
                staff_type,
                default_work_days: staff_type === "regular" ? default_work_days : null,
                hired_at: hired_at ? new Date(hired_at) : null,
                is_active: true,
            },
        });

        // Assign skill tags
        if (skill_ids && skill_ids.length > 0) {
            await prisma.user_skill_tags.createMany({
                data: skill_ids.map(skill_id => ({ user_id: newUser.user_id, skill_id: Number(skill_id) })),
                skipDuplicates: true,
            });
        }

        return res.status(201).json({ success: true, message: "Staff account created successfully." });
    } catch (error) {
        console.error("createStaffAccount error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
    createStaffAccount,
};