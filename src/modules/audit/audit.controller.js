
const auditService = require('./audit.service');
const { sendOk } = require('../../utils/respond');

async function list(req, res) {
  const result = await auditService.listAuditLogs(req.query);

  sendOk(res, result);
}

module.exports = { list };
