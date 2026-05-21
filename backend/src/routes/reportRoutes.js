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
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    createReportSchema,
    updateReportSchema
} = require("../validators/reportValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    getReports
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    getReportById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    validate(createReportSchema),
    createReport
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    validate(updateReportSchema),
    updateReport
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    deleteReport
);

module.exports = router;