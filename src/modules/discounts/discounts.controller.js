const service = require('./discounts.service');

async function list(req, res) {
  res.status(200).json(await service.listDiscounts());
}

module.exports = { list };