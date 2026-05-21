const { z } = require("zod");

const createRecommendationSchema = z.object({
    shift_id: z.number(),
    required_role: z.string().min(2, "Required role is needed"),
    required_skill: z.string().min(2, "Required skill is needed"),
    shift_date: z.string(),
    start_time: z.string(),
    end_time: z.string()
});

const updateRecommendationSchema = z.object({
    shift_id: z.number().optional(),
    required_role: z.string().min(2).optional(),
    required_skill: z.string().min(2).optional(),
    shift_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional()
});

module.exports = {
    createRecommendationSchema,
    updateRecommendationSchema
};