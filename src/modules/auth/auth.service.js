const jwt = require('jsonwebtoken');
const repo = require('../users/users.repository');
const { toPublicUser } = require('../users/users.service');
const { comparePassword } = require('../../utils/password');
const AppError = require('../../utils/AppError');
const { secret, expiresIn, algorithm } = require('../../config/jwt');
const bcrypt = require('bcryptjs');
const DUMMY_HASH = bcrypt.hashSync('dummy-password', Number(process.env.BCRYPT_SALT_ROUNDS) || 10);

async function login({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new AppError(400, 'Потрібні email та пароль');
  }

  const user = await repo.findByEmail(email.trim().toLowerCase());
  const passwordOk = await comparePassword(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !passwordOk) {
    throw new AppError(401, 'Невірний email або пароль');
  }

  if (!user.roles) {
    throw new AppError(403, 'Користувачу не призначено роль');
  }

  const token = jwt.sign({ role: user.roles.name }, secret, {
    subject: String(user.id),
    expiresIn,
    algorithm,
  });

  return { token, user: toPublicUser(user) };
}

module.exports = { login };