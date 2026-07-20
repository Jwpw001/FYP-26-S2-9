require("dotenv").config();

const app = require("./src/app");
const { startNotificationJobs } = require("./src/jobs/notificationJobs");

const PORT = process.env.PORT || 5000;

const healthRoutes = require("./src/routes/healthRoutes");

app.use("/api", healthRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startNotificationJobs();
});