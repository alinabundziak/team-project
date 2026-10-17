const service = require('./childParents.service');

async function link(req, res) {
  const result = await service.linkParent(req.params.id, req.body || {});
  res.status(201).json(result);
}

async function unlink(req, res) {
  await service.unlinkParent(req.params.id, req.params.parentId);
  res.status(204).send();
}

module.exports = { link, unlink };