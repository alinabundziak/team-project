const express = require("express");
const childrenRoutes = require("./modules/children/children.routes");
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Kindergarten server is working"
    });
});

app.use("/children", childrenRoutes);

const userRoutes = require('./modules/users/users.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);             

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/_examples', require('./modules/auth/auth.examples.routes'));
}

app.use(errorHandler);

module.exports = app;