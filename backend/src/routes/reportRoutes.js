const express = require("express");
const router = express.Router();

const {
    getReports,
    getReportById,
    createReport,
    updateReport,
    deleteReport
} = require("../controllers/reportController");

const validate = require("../middleware/validateMiddleware");

const {
    createReportSchema,
    updateReportSchema
} = require("../validators/reportValidator");

router.get("/", getReports);
router.get("/:id", getReportById);

router.post(
    "/",
    validate(createReportSchema),
    createReport
);

router.patch(
    "/:id",
    validate(updateReportSchema),
    updateReport
);

router.delete("/:id", deleteReport);

module.exports = router;