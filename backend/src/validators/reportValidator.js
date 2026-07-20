const { z } = require("zod");

const createReportSchema = z.object({
  branch_id:    z.number().nullable().optional(),
  report_type:  z.enum(["manager", "business_owner", "system_admin"]),
  format:       z.enum(["csv", "pdf"]),
  title:        z.string().min(1),
  period_start: z.string(),
  period_end:   z.string(),
});

module.exports = { createReportSchema };
