const express = require("express");
const router = express.Router();
const controller = require("./groups.controller");

const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

router.use(
    authenticate,
    authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)
);

router.get("/", controller.getGroups);
router.get("/occupancy", controller.getGroupsOccupancy);

router.post("/", controller.createGroup);
router.get("/:id", controller.getGroupById);
router.patch("/:id", controller.updateGroup);
router.delete("/:id", controller.deleteGroup);

router.get("/:id/children", controller.getGroupChildren);
router.post("/:id/children", controller.addChildToGroup);
router.delete("/:id/children/:childId", controller.removeChildFromGroup);

router.post("/:id/staff", controller.assignStaffToGroup);
router.delete("/:id/staff/:staffId", controller.removeStaffFromGroup);

module.exports = router;