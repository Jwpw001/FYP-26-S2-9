const { z } = require("zod");

const registerSchema = z.object({
    full_name: z.string().min(2, "Full name is required"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum([
    "system_admin",
    "outlet_manager",
    "regular_staff",
    "outlet_casual_staff",
    "krewby_coordinator",
    "krewby_casual_worker"
])
});

const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required")
});

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email format")
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    new_password: z.string().min(6, "Password must be at least 6 characters")
});

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};