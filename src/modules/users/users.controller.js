const usersService = require('./users.service');

async function create(req, res) {
  const { email, password, role } = req.body || {};
  const user = await usersService.createUser({ email, password, role });
  res.status(201).json(user);
}

async function getMe(req, res) {
  const user = await usersService.getMe(req.user.id);
  res.status(200).json(user);
}

module.exports = { create, getMe };