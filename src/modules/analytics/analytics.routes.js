const express = require('express');
const router = express.Router();

const analyticsController = require('./analytics.controller');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');
const { validateDateQuery } = require('../../middleware/validate');

const adminOnly = [authenticate, authorizeRoles(ROLES.ADMIN)];

router.get('/financial-summary', validateDateQuery, ...adminOnly, analyticsController.getFinancialSummary);
router.get('/debts', ...adminOnly, analyticsController.getDebts);
router.get('/revenue-forecast', ...adminOnly, analyticsController.getRevenueForecast);
router.post('/scenarios', ...adminOnly, analyticsController.runScenario);
router.get('/staff-optimization', ...adminOnly, analyticsController.getStaffOptimization);

module.exports = router;