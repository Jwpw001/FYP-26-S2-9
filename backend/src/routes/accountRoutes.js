const express = require("express");

const router = express.Router();

const {
    getAccount,
    updateAccount,
    deleteAccount
} = require("../controllers/accountController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    updateAccountSchema
} = require("../validators/accountValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF, ROLES.COORDINATOR),
    getAccount
);

router.patch(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.STAFF, ROLES.COORDINATOR),
    validate(updateAccountSchema),
    updateAccount
);

router.delete(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    deleteAccount
);

module.exports = router;