const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const errorHandler = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");

const accountRoutes = require("./routes/accountRoutes");
const staffRoutes = require("./routes/staffRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const krewbyRoutes = require("./routes/krewbyRoutes");

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Backend running"
    });
});

app.use("/api/auth", authRoutes);

app.use("/api/account", accountRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/krewby", krewbyRoutes);

app.use(errorHandler);

module.exports = app;