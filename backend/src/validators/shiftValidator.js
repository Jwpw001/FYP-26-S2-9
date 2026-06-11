const { z } = require("zod");

const createShiftSchema = z.object({
    outlet_id: z.number().optional(),   // auto-resolved from token; frontend may omit
    title: z.string().optional(),
    shift_date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    status: z.enum(["draft", "published"]).optional(),
    roles: z.array(z.object({
        role_name: z.string(),
        skill_id: z.number().optional(),
        headcount: z.number().optional()
    })).optional()
});

const updateShiftSchema = z.object({
    outlet_id: z.number().optional(),
    title: z.string().optional(),
    shift_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    status: z.enum(["draft", "published"]).optional()
});

module.exports = {
    createShiftSchema,
    updateShiftSchema
};
