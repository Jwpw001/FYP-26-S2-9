const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const errorHandler = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const staffRoutes = require("./routes/staffRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const skillRoutes = require("./routes/skillRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const krewbyRoutes = require("./routes/krewbyRoutes");
const prisma = require("./config/prisma");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Backend running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/krewby", krewbyRoutes);

// ─── /api/users?ids=1,2,3  (used by ShiftDetail for staff name lookup) ───────
app.get("/api/users", async (req, res) => {
  try {
    const { ids } = req.query;
    const idList = ids ? ids.split(",").map(Number).filter(Boolean) : [];
    const where = idList.length > 0 ? { user_id: { in: idList } } : {};
    const users = await prisma.users.findMany({
      where,
      select: { user_id: true, full_name: true, email: true, role: true }
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── /api/user-skill-tags?user_ids=1,2  (used by ShiftDetail recommendations) ─
app.get("/api/user-skill-tags", async (req, res) => {
  try {
    const { user_ids } = req.query;
    const ids = user_ids ? user_ids.split(",").map(Number).filter(Boolean) : [];
    const where = ids.length > 0 ? { user_id: { in: ids } } : {};
    const user_skill_tags = await prisma.user_skill_tags.findMany({
      where,
      include: { skills: { select: { skill_id: true, name: true } } }
    });
    res.json({ success: true, user_skill_tags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── /api/shift-roles?shift_id=X  (used by ShiftDetail) ─────────────────────
app.get("/api/shift-roles", async (req, res) => {
  try {
    const shift_id = Number(req.query.shift_id);
    if (!shift_id) return res.status(400).json({ success: false, message: "shift_id required" });
    const shift_roles = await prisma.shift_roles.findMany({
      where: { shift_id },
      include: { skills: true }
    });
    res.json({ success: true, shift_roles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── /api/shift-assignments  (used by ShiftDetail) ───────────────────────────
app.get("/api/shift-assignments", async (req, res) => {
  try {
    const shift_id = Number(req.query.shift_id);
    if (!shift_id) return res.status(400).json({ success: false, message: "shift_id required" });
    const shift_assignments = await prisma.shift_assignments.findMany({
      where: { shift_id },
      include: {
        staff: {
          include: {
            users: { select: { user_id: true, full_name: true, email: true } }
          }
        },
        shift_roles: { select: { role_id: true, role_name: true, skill_id: true } },
        attendance: true
      }
    });
    res.json({ success: true, shift_assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/shift-assignments", async (req, res) => {
  try {
    const { shift_id, role_id, staff_id, status, acknowledged } = req.body;
    const assignment = await prisma.shift_assignments.create({
      data: {
        shift_id: Number(shift_id),
        role_id: Number(role_id),
        staff_id: Number(staff_id),
        status: status || "assigned",
        acknowledged: acknowledged || false
      }
    });
    res.status(201).json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/shift-assignments/:id", async (req, res) => {
  try {
    await prisma.shift_assignments.delete({
      where: { assignment_id: Number(req.params.id) }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(errorHandler);

module.exports = app;
