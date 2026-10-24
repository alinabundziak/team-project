const service = require('./childParents.service');
const { sendCreated, sendNoContent } = require('../../utils/respond');

async function link(req, res) {
  sendCreated(res, await service.linkParent(req.params.id, req.body));
}

async function unlink(req, res) {
  await service.unlinkParent(req.params.id, req.params.parentId);
  sendNoContent(res);
}

module.exports = { link, unlink };