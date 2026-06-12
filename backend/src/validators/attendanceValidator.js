const { z } = require("zod");

const createAttendanceSchema = z.object({
    user_id: z.number(),

    shift_id: z.number(),

    check_in_time: z.string(),

    check_out_time: z.string().optional(),

    status: z.enum([
        "present",
        "late",
        "absent"
    ])
});

const updateAttendanceSchema = z.object({
    check_in_time: z.string().optional(),

    check_out_time: z.string().optional(),

    status: z.enum([
        "present",
        "late",
        "absent"
    ]).optional()
});

module.exports = {
    createAttendanceSchema,
    updateAttendanceSchema
};