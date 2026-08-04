const { z } = require("zod");

const registerSchema = z.object({
    full_name: z.string().min(2, "Full name is required"),
    username: z.string().min(2, "Username must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum([
        "system_admin",
        "business_owner",
        "manager",
        "regular_staff",
        "casual_staff"
    ]).optional().nullable(),
});

const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required")
});

module.exports = {
    registerSchema,
    loginSchema,
};