const service = require('./pricing.service');

async function tuitionEstimate(req, res) {
  res.status(200).json(await service.estimateTuition(req.params.childId, req.query));
}

async function mealEstimate(req, res) {
  res.status(200).json(await service.estimateMeals(req.params.childId, req.query));
}

module.exports = { tuitionEstimate, mealEstimate };