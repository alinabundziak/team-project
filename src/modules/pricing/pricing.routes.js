const express = require('express');
const controller = require('./pricing.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const charges = require('../charges/charges.controller');
const payments = require('../payments/payments.controller');
const refunds = require('../refunds/refunds.controller');
const router = express.Router();

router.get(
  '/children/:childId/tuition-estimate',
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  asyncHandler(controller.tuitionEstimate)
);

router.get(
  '/children/:childId/meal-estimate',
  authenticate,
  authorizeRoles(ROLES.ADMIN),
  asyncHandler(controller.mealEstimate)
);

router.get('/children/:childId/charges', authenticate, authorizeRoles(ROLES.ADMIN), asyncHandler(charges.list));
router.post('/children/:childId/charges', authenticate, authorizeRoles(ROLES.ADMIN), asyncHandler(charges.create));
router.get('/children/:childId/balance', authenticate, authorizeRoles(ROLES.ADMIN), asyncHandler(charges.balance));

router.post('/children/:childId/payments', authenticate, authorizeRoles(ROLES.ADMIN), asyncHandler(payments.create));
router.post('/children/:childId/refunds', authenticate, authorizeRoles(ROLES.ADMIN), asyncHandler(refunds.create));

module.exports = router;