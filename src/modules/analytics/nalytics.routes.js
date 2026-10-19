const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth'); 

router.use(authenticate, authorizeRoles('ADMIN'));
router.get('/financial-summary', analyticsController.getFinancialSummary);
router.get('/debts', analyticsController.getDebts);
router.get('/revenue-forecast', analyticsController.getRevenueForecast);
router.post('/scenarios', analyticsController.runScenario);

module.exports = router;