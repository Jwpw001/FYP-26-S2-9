const express = require("express");
const router = express.Router();

const { getStaff } = require("../controllers/staffController");

router.get("/", getStaff);

module.exports = router;