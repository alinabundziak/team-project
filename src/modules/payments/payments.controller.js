const service = require('./payments.service');

async function create(req, res) {
  res.status(201).json(await service.createPayment(req.params.childId, req.body || {}));
}

module.exports = { create };