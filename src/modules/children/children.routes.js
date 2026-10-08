const express = require("express");
const router = express.Router();

const controller = require("./children.controller");

router.get("/", controller.getChildren);

module.exports = router;