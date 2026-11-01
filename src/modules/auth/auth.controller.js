const authService = require('./auth.service');
const { sendOk } = require('../../utils/respond');

async function login(req, res) {
  sendOk(res, await authService.login(req.body));
}

module.exports = { login };