const express = require('express');
const controller = require('./pricing.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const { validateIdParam, validatePaymentInput } = require('../../middleware/validate');

const charges = require('../charges/charges.controller');
const payments = require('../payments/payments.controller');
const refunds = require('../refunds/refunds.controller');
const adjustments = require('../adjustments/adjustments.controller');

const router = express.Router();

const authAll = [authenticate];
const adminOnly = [authenticate, authorizeRoles(ROLES.ADMIN)]; 

router.get('/children/:childId/tuition-estimate', validateIdParam('childId'), ...authAll, asyncHandler(controller.tuitionEstimate));
router.get('/children/:childId/meal-estimate', validateIdParam('childId'), ...authAll, asyncHandler(controller.mealEstimate));
router.get('/children/:childId/charges', validateIdParam('childId'), ...authAll, asyncHandler(charges.list));
router.get('/children/:childId/balance', validateIdParam('childId'), ...authAll, asyncHandler(charges.balance));
router.get('/children/:childId/financial-history', validateIdParam('childId'), ...authAll, asyncHandler(charges.history));

router.post('/children/:childId/charges', validateIdParam('childId'), ...adminOnly, asyncHandler(charges.create));
router.post('/children/:childId/payments', validateIdParam('childId'), validatePaymentInput, ...adminOnly, asyncHandler(payments.create));
router.post('/children/:childId/refunds', validateIdParam('childId'), ...adminOnly, asyncHandler(refunds.create));
router.post('/children/:childId/adjustments', validateIdParam('childId'), ...adminOnly, asyncHandler(adjustments.create));

router.get('/pricing-plans', ...adminOnly, asyncHandler(controller.getPricingPlans));
router.post('/pricing-plans', ...adminOnly, asyncHandler(controller.createPricingPlan));
router.patch('/pricing-plans/:id', validateIdParam('id'), ...adminOnly, asyncHandler(controller.updatePricingPlan));
router.delete('/pricing-plans/:id', validateIdParam('id'), ...adminOnly, asyncHandler(controller.deletePricingPlan));

router.get('/meal-rates', ...adminOnly, asyncHandler(controller.getMealRates));

router.get('/benefits', ...adminOnly, asyncHandler(controller.getBenefits));
router.post('/benefits', ...adminOnly, asyncHandler(controller.createBenefit));
router.post('/children/:id/benefits', validateIdParam('id'), ...adminOnly, asyncHandler(controller.assignBenefit));
router.delete('/children/:id/benefits/:benefitId', validateIdParam('id'), validateIdParam('benefitId'), ...adminOnly, asyncHandler(controller.removeChildBenefit));

router.post('/pricing/calculate', ...adminOnly, asyncHandler(controller.calculatePrice));

router.get('/payments', ...adminOnly, asyncHandler(controller.getPayments));
router.get('/payments/:id', validateIdParam('id'), ...adminOnly, asyncHandler(controller.getPaymentById));
router.post('/payments', validatePaymentInput, ...adminOnly, asyncHandler(controller.createPayment));
router.patch('/payments/:id', validateIdParam('id'), validatePaymentInput, ...adminOnly, asyncHandler(controller.updatePayment));
router.delete('/payments/:id', validateIdParam('id'), ...adminOnly, asyncHandler(controller.deletePayment));

router.get('/cost-rules', ...adminOnly, asyncHandler(controller.getCostRules));
router.post('/cost-rules', ...adminOnly, asyncHandler(controller.createCostRule));
router.patch('/cost-rules/:id', validateIdParam('id'), ...adminOnly, asyncHandler(controller.updateCostRule));
router.delete('/cost-rules/:id', validateIdParam('id'), ...adminOnly, asyncHandler(controller.deleteCostRule));

module.exports = router;