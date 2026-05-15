const register = (req, res) => {
    res.status(201).json({
        success: true,
        message: "Register endpoint working"
    });
};

const login = (req, res) => {
    res.status(200).json({
        success: true,
        message: "Login endpoint working"
    });
};

module.exports = {
    register,
    login
};