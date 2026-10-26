const analyticsService = require('./analytics.service');

exports.getFinancialSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await analyticsService.getFinancialSummary(startDate, endDate);
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

exports.getDebts = async (req, res, next) => {
  try {
    const debts = await analyticsService.getDebtsReport();
    res.json(debts);
  } catch (error) {
    next(error);
  }
};

exports.getRevenueForecast = async (req, res, next) => {
  try {
    const forecast = await analyticsService.getRevenueForecast();
    res.json(forecast);
  } catch (error) {
    next(error);
  }
};

exports.runScenario = async (req, res, next) => {
  try {
    const scenarioParams = req.body;
    const result = await analyticsService.calculateScenario(scenarioParams);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.getStaffOptimization = async (req, res, next) => {
  try {
    const result = await analyticsService.getStaffOptimizationRecommendations();
    res.json(result);
  } catch (error) {
    next(error);
  }
};