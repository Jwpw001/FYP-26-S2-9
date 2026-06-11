const prisma = require("../config/prisma");
const reportService = require("../services/reportService");
const { getOutletId } = require("../utils/getOutletId");

const REPORT_FNS = {
    attendance:   reportService.getAttendanceReport,
    workload:     reportService.getWorkloadReport,
    understaffed: reportService.getUnderstaffedReport
};

// GET /api/reports?type=attendance&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
const getReports = async (req, res) => {
    try {
        const { type, start_date, end_date } = req.query;

        if (!type || !REPORT_FNS[type]) {
            return res.status(400).json({
                success: false,
                message: `Invalid report type. Use: ${Object.keys(REPORT_FNS).join(", ")}`
            });
        }
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: "start_date and end_date query params are required"
            });
        }

        const outletId = await getOutletId(req.user.user_id, req.user.role);
        if (!outletId) {
            return res.status(400).json({ success: false, message: "Outlet not found for this user" });
        }

        const result = await REPORT_FNS[type](outletId, start_date, end_date);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/reports/:id — fetch a saved report by ID
const getReportById = async (req, res) => {
    try {
        const report = await prisma.reports.findUnique({
            where: { report_id: Number(req.params.id) }
        });
        if (!report) return res.status(404).json({ success: false, message: "Report not found" });
        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getReports, getReportById };
