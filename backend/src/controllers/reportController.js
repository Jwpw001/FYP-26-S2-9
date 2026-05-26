const prisma = require("../config/prisma");

const getReports = async (req, res) => {
    try {
        const reports = await prisma.reports.findMany({
            orderBy: {
                report_id: "asc"
            }
        });

        res.json({
            success: true,
            reports
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getReportById = async (req, res) => {
    try {
        const reportId = Number(req.params.id);

        const report = await prisma.reports.findUnique({
            where: {
                report_id: reportId
            }
        });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found"
            });
        }

        res.json({
            success: true,
            report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createReport = async (req, res) => {
    try {
        const {
            user_id,
            title,
            report_type,
            content
        } = req.body;

        const report = await prisma.reports.create({
            data: {
                user_id,
                title,
                report_type,
                content
            }
        });

        res.status(201).json({
            success: true,
            message: "Report created successfully",
            report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateReport = async (req, res) => {
    try {
        const reportId = Number(req.params.id);

        const {
            title,
            report_type,
            content
        } = req.body;

        const report = await prisma.reports.update({
            where: {
                report_id: reportId
            },
            data: {
                title,
                report_type,
                content
            }
        });

        res.json({
            success: true,
            message: "Report updated successfully",
            report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteReport = async (req, res) => {
    try {
        const reportId = Number(req.params.id);

        await prisma.reports.delete({
            where: {
                report_id: reportId
            }
        });

        res.json({
            success: true,
            message: "Report deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getReports,
    getReportById,
    createReport,
    updateReport,
    deleteReport
};