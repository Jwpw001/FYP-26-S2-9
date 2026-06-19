const { z } = require("zod");

const updateAccountSchema = z.object({
    full_name: z.string().min(2).optional(),

    email: z.string().email().optional(),

    phone_number: z.string().min(8).optional(),

    role: z.enum([
        "system_admin",
        "outlet_manager",
        "regular_staff",
        "outlet_casual_staff",
        "krewby_casual_worker"
    ]).optional()
});

module.exports = {
    updateAccountSchema
};