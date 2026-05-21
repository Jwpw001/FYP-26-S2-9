const { z } = require("zod");

const createStaffSchema = z.object({
    full_name: z.string().min(2, "Full name is required"),

    email: z.string().email("Invalid email format"),

    phone_number: z.string().min(8, "Invalid phone number"),

    role: z.enum([
        "manager",
        "staff",
        "coordinator"
    ])
});

const updateStaffSchema = z.object({
    full_name: z.string().min(2).optional(),

    email: z.string().email().optional(),

    phone_number: z.string().min(8).optional(),

    role: z.enum([
        "manager",
        "staff",
        "coordinator"
    ]).optional()
});

module.exports = {
    createStaffSchema,
    updateStaffSchema
};