const jwt = require('jsonwebtoken');
const repo = require('../users/users.repository');
const { toPublicUser } = require('../users/users.service');
const { comparePassword } = require('../../utils/password');
const AppError = require('../../utils/AppError');
const { secret, expiresIn, algorithm } = require('../../config/jwt');

async function login({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new AppError(400, 'Потрібні email та пароль');
  }

  const user = await repo.findByEmail(email.trim().toLowerCase());
  const passwordOk = user ? await comparePassword(password, user.password_hash) : false;

  if (!user || !passwordOk) {
    throw new AppError(401, 'Невірний email або пароль');
  }

  const roleName = user.roles ? user.roles.name : (user.role ? user.role.name : null);

  if (!roleName) {
    throw new AppError(403, 'Користувачу не призначено роль');
  }

  const token = jwt.sign({ role: roleName }, secret, {
    subject: String(user.id),
    expiresIn,
    algorithm,
  });

  return { token, user: toPublicUser(user) };
}

module.exports = { login };