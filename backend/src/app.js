const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const errorHandler = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");

const accountRoutes = require("./routes/accountRoutes");
const staffRoutes = require("./routes/staffRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const aiAssistantRoutes = require("./routes/aiAssistantRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const businessOwnerRoutes = require("./routes/businessOwnerRoutes");
const skillsRoutes = require("./routes/skillsRoutes");
const casualRoutes = require("./routes/casualRoutes");
const timesheetRoutes = require("./routes/timesheetRoutes");

const app = express();

// Same-origin dev servers (Vite/Expo) plus whatever the deployed frontend's origin is.
// FRONTEND_URL supports a comma-separated list, e.g. your production domain plus any
// specific preview URLs you want to allow without needing a redeploy just to add one.
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:8081",
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map(s => s.trim()) : []),
].filter(Boolean);

// Baseline security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.) —
// this is a pure JSON API with no HTML views, so helmet's default CSP is a no-op here.
app.use(helmet());

app.use(cors({
    origin(origin, callback) {
        // Allow no-origin requests (curl, mobile apps, server-to-server), any explicitly
        // allow-listed origin, and any Vercel deployment of this project — Vercel preview
        // URLs are unpredictable per-branch/per-PR, so FRONTEND_URL alone isn't enough to
        // cover them without a redeploy every time a new preview URL shows up.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express.json());
app.use(morgan("dev"));

// Blanket rate limit across the API; login/register get a tighter limit below to slow brute-forcing.
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Please try again later." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/register-business", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

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
app.use("/api/reports", reportRoutes);
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/business", businessOwnerRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/casual", casualRoutes);
app.use("/api/timesheets", timesheetRoutes);

app.use(errorHandler);

module.exports = app;
