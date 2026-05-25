const { z } = require("zod");

const createShiftSchema = z.object({
    outlet_id: z.number(),
    title: z.string().min(2, "Shift title is required"),
    shift_date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    status: z.enum(["draft", "published"])
});

const updateShiftSchema = z.object({
    outlet_id: z.number().optional(),
    title: z.string().min(2).optional(),
    shift_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    status: z.enum(["draft", "published"]).optional()
});

module.exports = {
    createShiftSchema,
    updateShiftSchema
};