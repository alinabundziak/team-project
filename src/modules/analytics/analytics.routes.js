
const express = require('express');
const router = express.Router();

const analyticsController = require('./analytics.controller');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.get('/financial-summary', analyticsController.getFinancialSummary);
router.get('/debts', analyticsController.getDebts);
router.get('/revenue-forecast', analyticsController.getRevenueForecast);
router.post('/scenarios', analyticsController.runScenario);

module.exports = router;
