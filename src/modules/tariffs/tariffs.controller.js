const service = require('./tariffs.service');

async function list(req, res) {
  res.status(200).json(await service.listTariffs());
}

async function update(req, res) {
  res.status(200).json(await service.updateTariff(req.params.tariffId, req.body || {}));
}

module.exports = { list, update };