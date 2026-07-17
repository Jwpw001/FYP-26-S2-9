const { z } = require("zod");

const createStaffSchema = z.object({
    user_id: z.number(),
    branch_id: z.number(),
    staff_type: z.enum(["regular", "part_time", "full_time"]),
    default_work_days: z.string().optional(),
    hired_at: z.string().optional(),
    is_active: z.boolean().optional()
});

const updateStaffSchema = z.object({
    branch_id: z.number().optional(),
    staff_type: z.enum(["regular", "part_time", "full_time"]).optional(),
    default_work_days: z.string().optional(),
    hired_at: z.string().optional(),
    is_active: z.boolean().optional()
});

module.exports = {
    createStaffSchema,
    updateStaffSchema
};