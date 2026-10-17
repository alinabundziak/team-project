const service = require('./charges.service');

async function list(req, res) {
  res.status(200).json(await service.listCharges(req.params.childId, req.query));
}

async function create(req, res) {
  res.status(201).json(await service.createCharge(req.params.childId, req.body || {}));
}

async function balance(req, res) {
  res.status(200).json(await service.getBalance(req.params.childId));
}

module.exports = { list, create, balance };