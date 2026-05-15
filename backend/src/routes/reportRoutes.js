const express = require("express");
const router = express.Router();

const { getReports } = require("../controllers/reportController");

router.get("/", getReports);

module.exports = router;