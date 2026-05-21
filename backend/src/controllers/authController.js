const generateToken = require("../utils/generateToken");

const register = (req, res) => {
    res.status(201).json({
        success: true,
        message: "Register endpoint working",
        data: req.body
    });
};

const login = (req, res) => {
    const fakeUser = {
        id: 1,
        email: req.body.email,
        role: "manager"
    };

    const token = generateToken(fakeUser);

    res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: fakeUser
    });
};

const forgotPassword = (req, res) => {
    res.json({
        success: true,
        message: "Password reset request received",
        data: req.body
    });
};

const resetPassword = (req, res) => {
    res.json({
        success: true,
        message: "Password reset successful",
        data: req.body
    });
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword
};