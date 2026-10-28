const service = require('./charges.service');

async function list(req, res) {
  res.status(200).json(await service.listCharges(req.params.childId, req.query, req.user));
}

async function create(req, res) {
  res.status(201).json(await service.createCharge(req.params.childId, req.body || {}, req.user));
}

async function balance(req, res) {
  res.status(200).json(await service.getBalance(req.params.childId, req.user));
}

async function history(req, res) {
  res.status(200).json(await service.getFinancialHistory(req.params.childId, req.user));
}

module.exports = { list, create, balance, history };