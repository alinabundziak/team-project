const express = require('express');
const controller = require('./children.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const child_parents = require('../child_parents/child_parents.controller');
const { validate, idParams } = require('../../middleware/validate');
const v = require('./children.validators');

const router = express.Router();

const staff = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER);
const staffOrParent = authorizeRoles(ROLES.ADMIN, ROLES.MANAGER, ROLES.PARENT);

router.use(authenticate);

router.get('/', staff, validate({ query: v.validateListChildren }), asyncHandler(controller.list));
router.post('/', staff, validate({ body: v.validateCreateChild }), asyncHandler(controller.create));
router.get('/:id', staffOrParent, validate({ params: idParams('id') }), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  staff,
  validate({ params: idParams('id'), body: v.validateUpdateChild }),
  asyncHandler(controller.update)
);
router.patch(
  '/:id/parent-note',
  staffOrParent,
  validate({ params: idParams('id'), body: v.validateParentNote }),
  asyncHandler(controller.updateParentNote)
);
router.delete('/:id', staff, validate({ params: idParams('id') }), asyncHandler(controller.remove));
router.post(
  '/:id/parents',
  staff,
  validate({ params: idParams('id'), body: v.validateLinkParent }),
  asyncHandler(child_parents.link)
);
router.delete(
  '/:id/parents/:parentId',
  staff,
  validate({ params: idParams('id', 'parentId') }),
  asyncHandler(child_parents.unlink)
);

module.exports = router;