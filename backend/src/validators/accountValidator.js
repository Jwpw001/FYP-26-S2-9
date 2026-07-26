const { z } = require("zod");

const updateAccountSchema = z.object({
    full_name: z.string().min(2).optional(),

    email: z.string().email().optional(),

    phone_number: z.string().min(8).optional(),

    role: z.enum([
        "system_admin",
        "manager",
        "regular_staff",
        "casual_staff",
        "krewby_casual_worker"
    ]).optional(),

    avatar_url: z.enum([
        "/avatars/default.png",
        "/avatars/Untitled design (1).png",
        "/avatars/Untitled design (2).png",
        "/avatars/Untitled design (3).png",
    ]).optional()
});

module.exports = {
    updateAccountSchema
};