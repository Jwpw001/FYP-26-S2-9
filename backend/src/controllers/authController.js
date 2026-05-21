const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");

const register = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        const existingUser = await prisma.users.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.users.create({
            data: {
                full_name,
                email,
                password: hashedPassword,
                role
            }
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.users.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = generateToken({
            user_id: user.user_id,
            email: user.email,
            role: user.role
        });

        res.status(200).json({
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const forgotPassword = async (req, res) => {
    res.json({
        success: true,
        message: "Forgot password endpoint working"
    });
};

const resetPassword = async (req, res) => {
    res.json({
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