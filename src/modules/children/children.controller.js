const service = require('./children.service');
const { sendOk, sendCreated, sendNoContent } = require('../../utils/respond');

async function list(req, res) {
  sendOk(res, await service.listChildren(req.query));
}

async function getOne(req, res) {
  sendOk(res, await service.getChild(req.params.id, req.user));
}

async function create(req, res) {
  sendCreated(res, await service.createChild(req.body));
}

async function update(req, res) {
  sendOk(res, await service.updateChild(req.params.id, req.body));
}

async function updateParentNote(req, res) {
  sendOk(res, await service.updateParentNote(req.params.id, req.body, req.user));
}

async function remove(req, res) {
  await service.deleteChild(req.params.id);
  sendNoContent(res);
}

async function listMine(req, res) {
  sendOk(res, await service.listMyChildren(req.user, req.query));
}

module.exports = { list, getOne, create, update, remove, listMine, updateParentNote };