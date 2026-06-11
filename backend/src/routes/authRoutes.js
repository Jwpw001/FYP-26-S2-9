const express = require("express");
const router = express.Router();

const {
    register,
    login,
    forgotPassword,
    resetPassword,
    createStaffAccount,
    createWorkerAccount,
    getKrewbyWorkers,
    getWorkerAvailability,
    saveWorkerAvailability,
} = require("../controllers/authController");

const validate = require("../middleware/validateMiddleware");

const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} = require("../validators/authValidator");

const protect = require("../middleware/authMiddleware");

router.get("/me", protect, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

router.post("/register", validate(registerSchema), register);
router.post("/create-staff", protect, createStaffAccount);
router.get("/krewby-workers", protect, getKrewbyWorkers);
router.post("/create-worker", protect, createWorkerAccount);
router.get("/worker-availability", protect, getWorkerAvailability);
router.post("/worker-availability", protect, saveWorkerAvailability);
router.post("/login", validate(loginSchema), login);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

module.exports = router;