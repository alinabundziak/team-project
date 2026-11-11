const usersService = require('./users.service');
const { sendOk, sendCreated } = require('../../utils/respond');

async function create(req, res) {
  const { email, password, role } = req.body;
  sendCreated(res, await usersService.createUser({ email, password, role }));
}

async function getMe(req, res) {
  sendOk(res, await usersService.getMe(req.user.id));
}

module.exports = { create, getMe };