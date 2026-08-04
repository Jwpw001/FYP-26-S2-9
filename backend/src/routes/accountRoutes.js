const express = require("express");

const router = express.Router();

const {
    getAccount,
    updateAccount,
    deleteAccount,
    getAccountSkills,
    getMyBranch,
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
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF
    ),
    getAccount
);

router.patch(
    "/",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BUSINESS_OWNER,
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF
    ),
    validate(updateAccountSchema),
    updateAccount
);

router.get(
    "/skills",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.BRANCH_MANAGER,
        ROLES.REGULAR_STAFF,
        ROLES.BRANCH_CASUAL_STAFF
    ),
    getAccountSkills
);

router.get(
    "/branch",
    verifyToken,
    allowRoles(ROLES.BRANCH_MANAGER, ROLES.REGULAR_STAFF, ROLES.BRANCH_CASUAL_STAFF, ROLES.SYSTEM_ADMIN),
    getMyBranch
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
