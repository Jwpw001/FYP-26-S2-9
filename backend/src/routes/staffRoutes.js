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
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    getStaff
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    getStaffById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    validate(createStaffSchema),
    createStaff
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    validate(updateStaffSchema),
    updateStaff
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    deleteStaff
);

module.exports = router;