const { z } = require("zod");

// Frontend sends: full_name, email, staff_type, hired_at, skill_ids, role
const createStaffSchema = z.object({
    full_name: z.string().min(1),
    email: z.string().email(),
    staff_type: z.enum(["regular", "casual", "part_time", "full_time"]),
    hired_at: z.string().optional(),
    skill_ids: z.array(z.number()).optional(),
    role: z.string().optional(),
});

const updateStaffSchema = z.object({
    full_name: z.string().optional(),
    email: z.string().email().optional(),
    outlet_id: z.number().optional(),
    staff_type: z.enum(["regular", "casual", "part_time", "full_time"]).optional(),
    default_work_days: z.string().optional(),
    hired_at: z.string().optional(),
    is_active: z.boolean().optional(),
    skill_ids: z.array(z.number()).optional(),
});

module.exports = { createStaffSchema, updateStaffSchema };
