const service = require('./children.service');

async function list(req, res) {
  res.status(200).json(await service.listChildren(req.query));
}

async function getOne(req, res) {
  res.status(200).json(await service.getChild(req.params.id));
}

async function create(req, res) {
  res.status(201).json(await service.createChild(req.body || {}));
}

async function update(req, res) {
  res.status(200).json(await service.updateChild(req.params.id, req.body || {}));
}

async function remove(req, res) {
  await service.deleteChild(req.params.id);
  res.status(204).send();
}

module.exports = { list, getOne, create, update, remove };