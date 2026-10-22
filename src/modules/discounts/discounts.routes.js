const express = require('express');
const controller = require('./discounts.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles(ROLES.ADMIN), asyncHandler(controller.list));

module.exports = router;