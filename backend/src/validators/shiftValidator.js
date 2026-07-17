const { z } = require("zod");

const createShiftSchema = z.object({
    branch_id: z.number(),
    title: z.string().optional().nullable(),
    shift_date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    deadline: z.string().optional().nullable(),
    status: z.enum(["draft", "published"])
});

const updateShiftSchema = z.object({
    branch_id: z.number().optional(),
    title: z.string().min(2).optional(),
    shift_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    deadline: z.string().optional().nullable(),
    status: z.enum(["draft", "published", "cancelled", "completed"]).optional()
});

module.exports = {
    createShiftSchema,
    updateShiftSchema
};