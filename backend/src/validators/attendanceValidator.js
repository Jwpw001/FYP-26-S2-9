const { z } = require("zod");

const createAttendanceSchema = z.object({
    assignment_id: z.number(),
    status: z.enum(["present", "late", "absent"])
});

const updateAttendanceSchema = z.object({
    status: z.enum(["present", "late", "absent"]).optional()
});

module.exports = {
    createAttendanceSchema,
    updateAttendanceSchema
};
