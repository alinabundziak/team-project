const express = require('express');
const controller = require('./tariffs.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles(ROLES.ADMIN), asyncHandler(controller.list));
router.patch('/:tariffId', authorizeRoles(ROLES.ADMIN), asyncHandler(controller.update));

module.exports = router;