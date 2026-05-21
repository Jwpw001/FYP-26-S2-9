const { z } = require("zod");

const updateAccountSchema = z.object({
    full_name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone_number: z.string().min(8).optional(),
    role: z.enum(["manager", "staff", "coordinator"]).optional()
});

module.exports = {
    updateAccountSchema
};