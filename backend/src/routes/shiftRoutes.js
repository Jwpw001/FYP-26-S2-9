const express = require("express");
const router = express.Router();

const { getShifts } = require("../controllers/shiftController");

router.get("/", getShifts);

module.exports = router;