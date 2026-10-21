const express = require('express');
const controller = require('./users.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');

const router = express.Router();

router.get('/me', authenticate, asyncHandler(controller.getMe));

router.post('/', authenticate, authorizeRoles('ADMIN'), asyncHandler(controller.create));

module.exports = router;