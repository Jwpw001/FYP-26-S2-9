const { z } = require("zod");

const createShiftSchema = z.object({
    title: z.string().min(2, "Shift title is required"),

    shift_date: z.string(),

    start_time: z.string(),

    end_time: z.string(),

    required_staff: z.number().min(1),

    location: z.string().min(2),

    role: z.enum([
        "manager",
        "staff",
        "coordinator"
    ])
});

const updateShiftSchema = z.object({
    title: z.string().min(2).optional(),

    shift_date: z.string().optional(),

    start_time: z.string().optional(),

    end_time: z.string().optional(),

    required_staff: z.number().min(1).optional(),

    location: z.string().optional(),

    role: z.enum([
        "manager",
        "staff",
        "coordinator"
    ]).optional()
});

module.exports = {
    createShiftSchema,
    updateShiftSchema
};