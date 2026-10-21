const express = require("express");
const router = express.Router();
const controller = require("./staff.controller");

const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

router.use(
    authenticate,
    authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)
);

router.get("/", controller.getStaff);
router.post("/", controller.createStaff);
router.get("/:id", controller.getStaffById);
router.patch("/:id", controller.updateStaff);
router.delete("/:id", controller.deleteStaff);

module.exports = router;