const express = require('express');
const controller = require('./auth.controller');
const asyncHandler = require('../../utils/asyncHandler');
const { validate } = require('../../middleware/validate');
const v = require('./auth.validators');

const router = express.Router();

router.post('/login', validate({ body: v.validateLogin }), asyncHandler(controller.login));

module.exports = router;