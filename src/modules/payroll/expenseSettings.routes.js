const express = require("express");
const controller = require("./expenseSettings.controller");
const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.get("/", controller.getSettings);
router.patch("/", controller.updateSettings);

module.exports = router;