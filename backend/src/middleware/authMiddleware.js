const verifyToken = (req, res, next) => {
    // Temporary user for testing before real JWT/database
    req.user = {
        id: 1,
        role: "manager"
    };

    next();
};

module.exports = verifyToken;