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
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    getReports
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    getReportById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    validate(createReportSchema),
    createReport
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BRANCH_MANAGER,
        ROLES.SYSTEM_ADMIN
    ),
    validate(updateReportSchema),
    updateReport
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BRANCH_MANAGER
    ),
    deleteReport
);

module.exports = router;
