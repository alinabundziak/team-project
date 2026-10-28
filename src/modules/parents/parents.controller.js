const service = require('./parents.service');
const { sendOk, sendCreated, sendNoContent } = require('../../utils/respond');

async function list(req, res) {
  sendOk(res, await service.listParents(req.query));
}

async function getOne(req, res) {
  sendOk(res, await service.getParent(req.params.id));
}

async function create(req, res) {
  sendCreated(res, await service.createParent(req.body));
}

async function update(req, res) {
  sendOk(res, await service.updateParent(req.params.id, req.body));
}

async function remove(req, res) {
  await service.deleteParent(req.params.id);
  sendNoContent(res);
}

module.exports = { list, getOne, create, update, remove };