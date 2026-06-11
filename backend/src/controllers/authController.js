const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");

const login = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await prisma.users.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account not found. Please contact your administrator."
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive. Please contact your administrator."
            });
        }

        const token = generateToken({
            user_id: user.user_id,
            supabase_auth_id: user.supabase_auth_id,
            email: user.email,
            role: user.role
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_id: user.user_id,
                supabase_auth_id: user.supabase_auth_id,
                username: user.username,
                email: user.email,
                role: user.role,
                outlet_id: user.outlet_id,
                is_active: user.is_active
            }
        });

    } catch (error) {
        console.error("Login error:", error);

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

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword
};