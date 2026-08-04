const express = require("express");
const router = express.Router();

const {
    register,
    registerBusiness,
    login,
    forgotPassword,
    createStaffAccount,
    createManagerAccount,
} = require("../controllers/authController");

const validate = require("../middleware/validateMiddleware");

const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
} = require("../validators/authValidator");

const protect = require("../middleware/authMiddleware");

router.get("/me", protect, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

router.post("/register", validate(registerSchema), register);
router.post("/register-business", registerBusiness);
router.post("/create-staff", protect, createStaffAccount);
router.post("/create-manager", protect, createManagerAccount);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

module.exports = router;
