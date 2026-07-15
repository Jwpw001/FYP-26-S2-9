const express = require("express");

const router = express.Router();

const {
    getAccount,
    updateAccount,
    deleteAccount,
    getAccountSkills,
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
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BUSINESS_OWNER,
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getAccount
);

router.patch(
    "/",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BUSINESS_OWNER,
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    validate(updateAccountSchema),
    updateAccount
);

router.get(
    "/skills",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.OUTLET_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.OUTLET_CASUAL_STAFF,
        ROLES.KREWBY_CASUAL_WORKER
    ),
    getAccountSkills
);

router.delete(
    "/",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN
    ),
    deleteAccount
);

module.exports = router;
