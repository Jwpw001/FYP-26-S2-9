const express = require("express");
const router = express.Router();

const {
    register,
    login,
    forgotPassword,
    resetPassword
} = require("../controllers/authController");

const validate = require("../middleware/validateMiddleware");

const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} = require("../validators/authValidator");

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

module.exports = router;