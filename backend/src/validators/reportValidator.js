const { z } = require("zod");

const createReportSchema = z.object({
    user_id: z.number(),
    title: z.string().min(2, "Title is required"),
    report_type: z.enum(["attendance", "shift", "staff", "performance"]),
    content: z.string().min(2, "Content is required")
});

const updateReportSchema = z.object({
    title: z.string().min(2).optional(),
    report_type: z.enum(["attendance", "shift", "staff", "performance"]).optional(),
    content: z.string().min(2).optional()
});

module.exports = {
    createReportSchema,
    updateReportSchema
};