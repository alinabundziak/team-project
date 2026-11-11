const express = require("express");
const controller = require("./activities.controller");
const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

const router = express.Router();

router.use(
    authenticate,
    authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)
);

router.get("/:id/teachers", controller.getTeachers);
router.post("/:id/teachers", controller.assignTeacher);
router.delete("/:id/teachers/:teacherId", controller.removeTeacher);

module.exports = router;