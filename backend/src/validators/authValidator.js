const { z } = require("zod");

const registerSchema = z.object({
    full_name: z.string().min(2, "Full name is required"),
    username: z.string().min(2, "Username must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum([
        "system_admin",
        "business_owner",
        "outlet_manager",
        "regular_staff",
        "outlet_casual_staff",
        "krewby_coordinator",
        "krewby_casual_worker"
    ]).optional().nullable(),
});

const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().optional()
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