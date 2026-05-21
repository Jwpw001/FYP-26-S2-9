const getReports = (req, res) => {
    res.json({
        success: true,
        message: "Get all reports"
    });
};

const getReportById = (req, res) => {
    res.json({
        success: true,
        message: "Get report by ID",
        reportId: req.params.id
    });
};

const createReport = (req, res) => {
    res.status(201).json({
        success: true,
        message: "Create report",
        data: req.body
    });
};

const updateReport = (req, res) => {
    res.json({
        success: true,
        message: "Update report",
        reportId: req.params.id,
        data: req.body
    });
};

const deleteReport = (req, res) => {
    res.json({
        success: true,
        message: "Delete report",
        reportId: req.params.id
    });
};

module.exports = {
    getReports,
    getReportById,
    createReport,
    updateReport,
    deleteReport
};