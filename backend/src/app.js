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
const aiAssistantRoutes = require("./routes/aiAssistantRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const businessOwnerRoutes = require("./routes/businessOwnerRoutes");
const skillsRoutes = require("./routes/skillsRoutes");
const casualRoutes = require("./routes/casualRoutes");
const timesheetRoutes = require("./routes/timesheetRoutes");

const app = express();

app.use(cors());
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
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/business", businessOwnerRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/casual", casualRoutes);
app.use("/api/timesheets", timesheetRoutes);

app.use(errorHandler);

module.exports = app;