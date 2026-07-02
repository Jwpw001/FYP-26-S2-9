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
const projectRoutes       = require("./routes/projectRoutes");
const timesheetRoutes     = require("./routes/timesheetRoutes");
const bookingRoutes       = require("./routes/bookingRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
    res.status(200).json({ success: true, message: "Backend running" });
});

// Public: catalog skills by industry (used during registration)
const prismaClient = require("./config/prisma");
app.get("/api/catalog/skills", async (req, res) => {
    try {
        const { industry } = req.query;
        const skills = await prismaClient.skills.findMany({
            where: { is_catalog: true, industry_type: industry || "other" },
            select: { skill_id: true, name: true, description: true },
            orderBy: { name: "asc" },
        });
        res.json({ success: true, skills });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
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
app.use("/api/projects",    projectRoutes);
app.use("/api/timesheets",  timesheetRoutes);
app.use("/api/bookings",    bookingRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/business",    businessOwnerRoutes);
app.use("/api/flex",        require("./routes/flexibleRoutes"));
app.use("/api/skills",      require("./routes/skillsRoutes"));

app.use(errorHandler);

module.exports = app;