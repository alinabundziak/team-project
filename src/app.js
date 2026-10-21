const express = require("express");
const childrenRoutes = require("./modules/children/children.routes");
const roomsRoutes = require("./modules/rooms/rooms.routes");
const staffRoutes = require("./modules/employees/staff.routes");
const groupsRoutes = require("./modules/groups/groups.routes");
const optimizationRoutes = require("./modules/optimization/optimization.routes");

const payrollRoutes = require("./modules/payroll/payroll.routes");
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Kindergarten server is working"
    });
});

app.use("/children", childrenRoutes);
app.use("/rooms", roomsRoutes);
app.use("/staff", staffRoutes);
app.use("/groups", groupsRoutes);

app.use("/api/groups", groupsRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/optimization", optimizationRoutes);

const userRoutes = require("./modules/users/users.routes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

if (process.env.NODE_ENV !== "production") {
  app.use(
    "/api/_examples",
    require("./modules/auth/auth.examples.routes")
  );
}

app.use(errorHandler);

module.exports = app;
