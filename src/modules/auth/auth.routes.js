const express = require('express');
const controller = require('./auth.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');

const router = express.Router();

router.post('/login', asyncHandler(controller.login));

module.exports = router;