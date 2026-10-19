const analyticsService = require('./analytics.service');

class AnalyticsController {
  async getFinancialSummary(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const data = await analyticsService.getFinancialSummary(startDate, endDate);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async getDebts(req, res, next) {
    try {
      const data = await analyticsService.getDebtsReport();
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async getRevenueForecast(req, res, next) {
    try {
      const data = await analyticsService.getRevenueForecast();
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async runScenario(req, res, next) {
    try {
      const data = await analyticsService.calculateScenario(req.body);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }
}
module.exports = new AnalyticsController();