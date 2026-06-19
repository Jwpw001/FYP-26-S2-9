const express = require("express");
const prisma = require("../config/prisma");

const router = express.Router();

router.get("/health", async (req, res) => {
  res.json({ status: "Backend is running" });
});

router.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "Database connected successfully" });
  } catch (error) {
    res.status(500).json({
      status: "Database connection failed",
      error: error.message,
    });
  }
});

module.exports = router;
