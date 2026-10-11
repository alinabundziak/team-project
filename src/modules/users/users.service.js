const repo = require('./users.repository');
const AppError = require('../../utils/AppError');
const { hashPassword } = require('../../utils/password');

const ROLES = ['ADMIN', 'MANAGER', 'TEACHER', 'PARENT'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.roles ? user.roles.name : null,
    createdAt: user.created_at,
  };
}

async function createUser({ email, password, role }) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 150) {
    throw new AppError(400, 'Некоректний email');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new AppError(400, 'Пароль має містити від 8 до 72 символів');
  }
  if (!ROLES.includes(role)) {
    throw new AppError(400, `Роль має бути однією з: ${ROLES.join(', ')}`);
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (await repo.findByEmail(normalizedEmail)) {
    throw new AppError(409, 'Користувач з таким email уже існує');
  }

  const roleRecord = await repo.findRoleByName(role);
  if (!roleRecord) {
    throw new AppError(500, `Роль ${role} відсутня в таблиці roles (потрібен seed)`);
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await repo.create({
      email: normalizedEmail,
      passwordHash,
      roleId: roleRecord.id,
    });
    return toPublicUser(user);
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError(409, 'Користувач з таким email уже існує');
    }
    throw err;
  }
}

async function getMe(userId) {
  const user = await repo.findById(userId);
  if (!user) {
    throw new AppError(404, 'Користувача не знайдено');
  }
  return toPublicUser(user);
}

module.exports = { createUser, getMe, toPublicUser, ROLES };