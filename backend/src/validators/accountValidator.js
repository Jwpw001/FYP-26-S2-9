const { z } = require("zod");

const updateAccountSchema = z.object({
    full_name: z.string().min(2).optional(),

    email: z.string().email().optional(),

    phone_number: z.string().min(8).optional(),

    role: z.enum([
        "system_admin",
        "manager",
        "regular_staff",
        "casual_staff"
    ]).optional(),

    avatar_url: z.enum([
        "/avatars/default.png",
        "/avatars/avatar1.png",
        "/avatars/avatar2.png",
        "/avatars/avatar3.png",
        "/avatars/avatar4.png",
        "/avatars/avatar5.png",
        "/avatars/avatar6.png",
        "/avatars/avatar7.png",
        "/avatars/avatar8.png",
        "/avatars/avatar9.png",
    ]).optional()
});

module.exports = {
    updateAccountSchema
};