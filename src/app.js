const express = require("express");

const childrenRoutes = require("./modules/children/children.routes");
const pricingRoutes = require("./modules/pricing/pricing.routes");
const analyticsRouter = require("./modules/analytics/analytics.routes");
const roomsRoutes = require("./modules/rooms/rooms.routes");
const staffRoutes = require("./modules/employees/staff.routes");
const activitiesRoutes = require("./modules/activities/activities.routes");
const groupsRoutes = require("./modules/groups/groups.routes");
const optimizationRoutes = require("./modules/optimization/optimization.routes");
const payrollRoutes = require("./modules/payroll/payroll.routes");
const expenseSettingsRoutes = require("./modules/payroll/expenseSettings.routes");
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/users.routes");
const autoScheduleRoutes = require("../controllers/autoScheduleRoutes");


const scheduleRouter = require("./routes/schedule.router");

const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Kindergarten server is working"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/children", childrenRoutes);
app.use("/api/parents", require("./modules/parents/parents.routes"));
app.use("/api/groups", groupsRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/expense-settings", expenseSettingsRoutes);
app.use("/api/optimization", optimizationRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/analytics", analyticsRouter);
app.use("/api/discounts", require("./modules/discounts/discounts.routes"));
app.use("/api/tariffs", require("./modules/tariffs/tariffs.routes"));
app.use("/api", autoScheduleRoutes);

app.use("/api", scheduleRouter);

if (process.env.NODE_ENV !== "production") {
  app.use(
    "/api/_examples",
    require("./modules/auth/auth.examples.routes")
  );
}

app.use(errorHandler);

module.exports = app;
