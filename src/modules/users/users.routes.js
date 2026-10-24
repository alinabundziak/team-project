const express = require('express');
const controller = require('./users.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const { validate } = require('../../middleware/validate');
const v = require('./users.validators');

const router = express.Router();

router.get('/me', authenticate, asyncHandler(controller.getMe));
router.post(
  '/',
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  validate({ body: v.validateCreateUser }),
  asyncHandler(controller.create)
);

module.exports = router;