const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth'); 

router.use(authenticate);
router.use(authorizeRoles('ADMIN'));
router.get('/financial-summary', (req, res, next) => analyticsController.getFinancialSummary(req, res, next));
router.get('/debts', (req, res, next) => analyticsController.getDebts(req, res, next));
router.get('/revenue-forecast', (req, res, next) => analyticsController.getRevenueForecast(req, res, next));
router.post('/scenarios', (req, res, next) => analyticsController.runScenario(req, res, next));

module.exports = router;