
const express = require('express');

const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const controller = require('./audit.controller');
const { validateListAudit } = require('./audit.validators');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  validate({ query: validateListAudit }),
  asyncHandler(controller.list)
);

module.exports = router;
