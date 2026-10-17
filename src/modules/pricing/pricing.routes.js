const express = require('express');
const controller = require('./pricing.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');

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

module.exports = router;