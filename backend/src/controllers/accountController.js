const prisma = require("../config/prisma");

const getAccount = async (req, res) => {
    try {
        const user = await prisma.users.findUnique({
            where: {
                user_id: req.user.user_id || req.user.id
            },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                created_at: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateAccount = async (req, res) => {
    try {
        const { full_name, email } = req.body;

        const updatedUser = await prisma.users.update({
            where: {
                user_id: req.user.user_id || req.user.id
            },
            data: {
                full_name,
                email
            },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true
            }
        });

        res.json({
            success: true,
            message: "Account updated successfully",
            user: updatedUser
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteAccount = async (req, res) => {
    try {
        await prisma.users.delete({
            where: {
                user_id: req.user.user_id || req.user.id
            }
        });

        res.json({
            success: true,
            message: "Account deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAccount,
    updateAccount,
    deleteAccount
};