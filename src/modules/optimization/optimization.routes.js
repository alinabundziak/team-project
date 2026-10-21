
const express = require("express");
const router = express.Router();

const controller = require("./optimization.controller");

const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

router.use(
    authenticate,
    authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)
);

router.post("/recommendations", controller.getRecommendations);

module.exports = router;
