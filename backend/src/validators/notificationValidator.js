const { z } = require("zod");

const createNotificationSchema = z.object({
    recipient_id: z.number(),

    title: z.string().min(2, "Title is required"),

    message: z.string().min(2, "Message is required"),

    type: z.enum([
        "shift",
        "attendance",
        "system",
        "request"
    ]),

    related_entity: z.string().optional(),

    related_id: z.number().optional()
});

const updateNotificationSchema = z.object({
    title: z.string().min(2).optional(),

    message: z.string().min(2).optional(),

    type: z.enum([
        "shift",
        "attendance",
        "system",
        "request"
    ]).optional(),

    is_read: z.boolean().optional()
});

module.exports = {
    createNotificationSchema,
    updateNotificationSchema
};