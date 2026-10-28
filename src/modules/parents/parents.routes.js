const express = require('express');
const controller = require('./parents.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const childrenController = require('../children/children.controller');
const { validate, idParams } = require('../../middleware/validate');
const v = require('./parents.validators');

const router = express.Router();

const staff = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER);

router.use(authenticate);

router.get('/', staff, validate({ query: v.validateListParents }), asyncHandler(controller.list));
router.post('/', staff, validate({ body: v.validateCreateParent }), asyncHandler(controller.create));

router.get(
  '/me/children',
  authorizeRoles(ROLES.PARENT),
  validate({ query: v.validatePageQuery }),
  asyncHandler(childrenController.listMine)
);

router.get('/:id', staff, validate({ params: idParams('id') }), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  staff,
  validate({ params: idParams('id'), body: v.validateUpdateParent }),
  asyncHandler(controller.update)
);
router.delete('/:id', staff, validate({ params: idParams('id') }), asyncHandler(controller.remove));

module.exports = router;