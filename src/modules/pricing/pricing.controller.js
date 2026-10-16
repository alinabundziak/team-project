const service = require('./pricing.service');

async function tuitionEstimate(req, res) {
  res.status(200).json(await service.estimateTuition(req.params.childId, req.query));
}

module.exports = { tuitionEstimate };