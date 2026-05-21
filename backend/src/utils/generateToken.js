const jwt = require("jsonwebtoken");

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        process.env.JWT_SECRET || "temporary_secret",
        {
            expiresIn: "1d"
        }
    );
};

module.exports = generateToken;