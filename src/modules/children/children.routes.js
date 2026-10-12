const express = require('express');
const controller = require('./children.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.use(authenticate);

const staff = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER);

router.get('/', staff, asyncHandler(controller.list));
router.post('/', staff, asyncHandler(controller.create));
router.get('/:id', staff, asyncHandler(controller.getOne));
router.patch('/:id', staff, asyncHandler(controller.update));
router.delete('/:id', staff, asyncHandler(controller.remove));

module.exports = router;