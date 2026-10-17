const service = require('./parents.service');

async function list(req, res) {
  res.status(200).json(await service.listParents(req.query));
}

async function getOne(req, res) {
  res.status(200).json(await service.getParent(req.params.id));
}

async function create(req, res) {
  res.status(201).json(await service.createParent(req.body || {}));
}

async function update(req, res) {
  res.status(200).json(await service.updateParent(req.params.id, req.body || {}));
}

async function remove(req, res) {
  await service.deleteParent(req.params.id);
  res.status(204).send();
}

module.exports = { list, getOne, create, update, remove };