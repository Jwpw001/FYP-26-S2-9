const prisma = require("../config/prisma");

async function getStaffId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { staff_id: true, outlet_id: true } });
  return s || null;
}

// ── Staff: submit a timesheet entry ──────────────────────────────────────────
const submitTimesheet = async (req, res) => {
  try {
    const staffRow = await getStaffId(req.user.user_id);
    if (!staffRow) return res.status(403).json({ success: false, message: "Staff record not found." });

    const { project_id, log_date, hours_worked, description } = req.body;
    if (!log_date || hours_worked == null) return res.status(400).json({ success: false, message: "log_date and hours_worked are required." });

    const entry = await prisma.timesheets.upsert({
      where: { staff_id_project_id_log_date: { staff_id: staffRow.staff_id, project_id: project_id ? Number(project_id) : null, log_date: new Date(log_date) } },
      create: { staff_id: staffRow.staff_id, project_id: project_id ? Number(project_id) : null, log_date: new Date(log_date), hours_worked: Number(hours_worked), description: description || null, status: "pending" },
      update: { hours_worked: Number(hours_worked), description: description || null, status: "pending" },
    });

    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Staff: get my timesheets ──────────────────────────────────────────────────
const getMyTimesheets = async (req, res) => {
  try {
    const staffRow = await getStaffId(req.user.user_id);
    if (!staffRow) return res.status(403).json({ success: false, message: "Staff record not found." });

    const { weekStart, weekEnd } = req.query;
    const where = { staff_id: staffRow.staff_id };
    if (weekStart && weekEnd) {
      where.log_date = { gte: new Date(weekStart), lte: new Date(weekEnd) };
    }

    const timesheets = await prisma.timesheets.findMany({
      where,
      include: { projects: { select: { name: true, color: true } } },
      orderBy: { log_date: "desc" }
    });

    res.json({ success: true, timesheets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Manager: get all timesheets for outlet ───────────────────────────────────
const getAllTimesheets = async (req, res) => {
  try {
    const staffRow = await getStaffId(req.user.user_id);
    if (!staffRow) return res.status(403).json({ success: false, message: "No outlet found." });

    const { weekStart, weekEnd, status } = req.query;

    // Get all staff in this outlet
    const outletStaff = await prisma.staff.findMany({
      where: { outlet_id: staffRow.outlet_id, is_active: true },
      select: { staff_id: true }
    });
    const staffIds = outletStaff.map(s => s.staff_id);

    const where = { staff_id: { in: staffIds } };
    if (weekStart && weekEnd) where.log_date = { gte: new Date(weekStart), lte: new Date(weekEnd) };
    if (status) where.status = status;

    const timesheets = await prisma.timesheets.findMany({
      where,
      include: {
        staff:    { include: { users: { select: { full_name: true } } } },
        projects: { select: { name: true, color: true } }
      },
      orderBy: [{ log_date: "desc" }, { staff_id: "asc" }]
    });

    res.json({ success: true, timesheets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Manager: approve or reject a timesheet ───────────────────────────────────
const reviewTimesheet = async (req, res) => {
  try {
    const { status } = req.body; // "approved" | "rejected"
    if (!["approved","rejected"].includes(status)) return res.status(400).json({ success: false, message: "Status must be approved or rejected." });

    const entry = await prisma.timesheets.update({
      where:  { timesheet_id: Number(req.params.id) },
      data:   { status, reviewed_by: req.user.user_id, reviewed_at: new Date() }
    });

    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Manager: bulk approve ─────────────────────────────────────────────────────
const bulkApprove = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: "ids array required." });

    await prisma.timesheets.updateMany({
      where:  { timesheet_id: { in: ids.map(Number) } },
      data:   { status: "approved", reviewed_by: req.user.user_id, reviewed_at: new Date() }
    });

    res.json({ success: true, updated: ids.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { submitTimesheet, getMyTimesheets, getAllTimesheets, reviewTimesheet, bulkApprove };
