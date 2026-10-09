const express = require("express");
const childrenRoutes = require("./modules/children/children.routes");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Kindergarten server is working"
    });
});

app.use("/children", childrenRoutes);

module.exports = app;