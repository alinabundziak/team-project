
const express = require('express');
const router = express.Router();

const analyticsController = require('./analytics.controller');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');

router.use(authenticate);
router.use(authorizeRoles('ADMIN', 'FINANCIER'));

router.get('/financial-summary', analyticsController.getFinancialSummary);
router.get('/debts', analyticsController.getDebts);
router.get('/revenue-forecast', analyticsController.getRevenueForecast);
router.post('/scenarios', analyticsController.runScenario);

module.exports = router;
