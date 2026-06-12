const { z } = require("zod");

const createAvailabilitySchema = z.object({
    staff_id: z.number(),
    leave_type: z.string().min(2, "Leave type is required"),
    start_date: z.string(),
    end_date: z.string(),
    reason: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected"])
});

const updateAvailabilitySchema = z.object({
    leave_type: z.string().min(2).optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    reason: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    reviewed_by: z.number().optional(),
    reviewed_at: z.string().optional()
});

module.exports = {
    createAvailabilitySchema,
    updateAvailabilitySchema
};