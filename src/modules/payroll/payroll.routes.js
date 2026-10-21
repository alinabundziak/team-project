const express = require("express");
const router = express.Router();
const controller = require("./payroll.controller");

const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

router.use(
    authenticate,
    authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)
);

router.get("/kindergarten", controller.getKindergartenPayroll);
router.get("/groups/:id", controller.getGroupPayroll);

module.exports = router;