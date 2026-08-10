const prisma = require("../config/prisma");

const getReports = async (req, res) => {
  try {
    const { user_id, role } = req.user;

    const where = role === "system_admin"
      ? {}
      : { generated_by: user_id };

    const reports = await prisma.reports.findMany({
      where,
      include: { users: { select: { full_name: true, email: true } } },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    res.json({ success: true, reports });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const createReport = async (req, res) => {
  try {
    const { user_id } = req.user;
    const { branch_id, report_type, format, title, period_start, period_end } = req.body;

    const report = await prisma.reports.create({
      data: {
        generated_by: user_id,
        branch_id:    branch_id ?? null,
        report_type,
        format,
        title,
        period_start: new Date(period_start),
        period_end:   new Date(period_end),
      },
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

module.exports = { getReports, createReport };
