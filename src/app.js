const express = require("express");
const childrenRoutes = require("./modules/children/children.routes");
const roomsRoutes = require("./modules/rooms/rooms.routes");
const staffRoutes = require("./modules/employees/staff.routes");
const groupsRoutes = require("./modules/groups/groups.routes");

const payrollRoutes = require("./modules/payroll/payroll.routes");

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

module.exports = app;