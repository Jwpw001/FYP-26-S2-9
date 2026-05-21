const express = require("express");
const router = express.Router();

const {
    getAccount,
    updateAccount,
    deleteAccount
} = require("../controllers/accountController");

const validate = require("../middleware/validateMiddleware");

const {
    updateAccountSchema
} = require("../validators/accountValidator");

router.get("/", getAccount);

router.patch(
    "/",
    validate(updateAccountSchema),
    updateAccount
);

router.delete("/", deleteAccount);

module.exports = router;