const service = require('./adjustments.service');

async function create(req, res) {
  const result = await service.createAdjustment(req.params.childId, req.body || {}, req.user.id);
  res.status(201).json(result);
}

module.exports = { create };