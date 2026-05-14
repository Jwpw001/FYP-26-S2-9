const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const errorHandler = require("./middleware/errorMiddleware");

// future routes
// const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Backend running"
    });
});

// Future API routes
// app.use("/api/auth", authRoutes);

// Global error middleware
app.use(errorHandler);

module.exports = app;