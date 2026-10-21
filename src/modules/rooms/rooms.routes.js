const express = require("express");
const router = express.Router();
const controller = require("./rooms.controller");

const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");

router.use(
    authenticate,
    authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)
);

router.get("/", controller.getRooms);
router.post("/", controller.createRoom);
router.get("/:id", controller.getRoomById);
router.patch("/:id", controller.updateRoom);
router.delete("/:id", controller.deleteRoom);

module.exports = router;