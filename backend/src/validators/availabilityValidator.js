const { z } = require("zod");

const createAvailabilitySchema = z.object({
    user_id: z.number(),

    available_date: z.string(),

    start_time: z.string(),

    end_time: z.string(),

    status: z.enum([
        "available",
        "unavailable"
    ])
});

const updateAvailabilitySchema = z.object({
    available_date: z.string().optional(),

    start_time: z.string().optional(),

    end_time: z.string().optional(),

    status: z.enum([
        "available",
        "unavailable"
    ]).optional()
});

module.exports = {
    createAvailabilitySchema,
    updateAvailabilitySchema
};