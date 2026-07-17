const express = require("express");

const router = express.Router();

const {
    getStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff
} = require("../controllers/staffController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    createStaffSchema,
    updateStaffSchema
} = require("../validators/staffValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN),
    getStaff
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER, ROLES.SYSTEM_ADMIN),
    getStaffById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER),
    validate(createStaffSchema),
    createStaff
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER),
    validate(updateStaffSchema),
    updateStaff
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER),
    deleteStaff
);

module.exports = router;
