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

module.exports = {
    register,
    login
};