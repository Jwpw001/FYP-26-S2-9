const express = require("express");
const router = express.Router();

const { getAccount } = require("../controllers/accountController");

router.get("/", getAccount);

module.exports = router;