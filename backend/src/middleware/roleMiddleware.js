const prisma = require("../config/prisma");

const allowRoles = (...allowedRoles) => {
    return async (req, res, next) => {
        try {

            const email = req.user.email;

            const user = await prisma.users.findUnique({
                where: {
                    email
                }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User profile not found"
                });
            }

            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied"
                });
            }

            req.dbUser = user;

            next();

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };
};

module.exports = allowRoles;