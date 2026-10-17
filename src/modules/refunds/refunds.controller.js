const service = require('./refunds.service');

async function create(req, res) {
  res.status(201).json(await service.createRefund(req.params.childId, req.body || {}));
}

module.exports = { create };