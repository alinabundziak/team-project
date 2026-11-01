const repo = require('./parents.repository');
const usersRepo = require('../users/users.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { validateName, validatePhone } = require('../../utils/validators');
const { parsePagination } = require('../../utils/pagination');
const { ROLES } = require('../../config/roles');

const PHONE_SEPARATORS_RE = /[\s\-().]/g;
const MAX_SEARCH_LENGTH = 100;

function toParentDto(p) {
  return {
    id: p.id,
    userId: p.user_id,
    email: p.users ? p.users.email : null,
    firstName: p.first_name,
    lastName: p.last_name,
    phone: p.phone,
  };
}

function validateUserId(value) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, 'userId має бути цілим додатним числом');
  }
  return value;
}

async function listParents(query = {}) {
  const { page, limit } = parsePagination(query);

  const where = {};
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > MAX_SEARCH_LENGTH) {
      throw new AppError(400, 'Некоректний параметр search');
    }
    const s = query.search.trim();
    if (s) {
      const or = [
        { first_name: { contains: s, mode: 'insensitive' } },
        { last_name: { contains: s, mode: 'insensitive' } },
      ];
      const phonePart = s.replace(PHONE_SEPARATORS_RE, '');
      if (phonePart) or.push({ phone: { contains: phonePart } });
      where.OR = or;
    }
  }

  const [items, total] = await Promise.all([
    repo.findMany({ where, skip: (page - 1) * limit, take: limit }),
    repo.count(where),
  ]);

  return { data: items.map(toParentDto), meta: { page, limit, total } };
}

async function getParent(rawId) {
  const id = parseId(rawId);
  const parent = await repo.findById(id);
  if (!parent) throw new AppError(404, 'Батька не знайдено');
  return toParentDto(parent);
}

async function createParent(input) {
  const userId = validateUserId(input.userId);
  const data = {
    user_id: userId,
    first_name: validateName(input.firstName, "Ім'я"),
    last_name: validateName(input.lastName, 'Прізвище'),
    phone: validatePhone(input.phone),
  };

  const user = await usersRepo.findById(userId);
  if (!user) throw new AppError(404, 'Користувача не знайдено');

  if (!user.roles || user.roles.name !== ROLES.PARENT) {
    throw new AppError(409, `Профіль батька можна створити лише для користувача з роллю ${ROLES.PARENT}`);
  }

  if (await repo.findByUserId(userId)) {
    throw new AppError(409, 'Для цього користувача профіль батька вже існує');
  }

  try {
    const parent = await repo.create(data);
    return toParentDto(parent);
  } catch (err) {
    if (err.code === 'P2002') throw new AppError(409, 'Для цього користувача профіль батька вже існує');
    if (err.code === 'P2003') throw new AppError(404, 'Користувача не знайдено');
    throw err;
  }
}

async function updateParent(rawId, input) {
  const id = parseId(rawId);

  if (input.userId !== undefined) {
    throw new AppError(400, 'userId змінювати не можна');
  }

  const data = {};
  if (input.firstName !== undefined) data.first_name = validateName(input.firstName, "Ім'я");
  if (input.lastName !== undefined) data.last_name = validateName(input.lastName, 'Прізвище');
  if (input.phone !== undefined) data.phone = validatePhone(input.phone);

  if (Object.keys(data).length === 0) {
    throw new AppError(400, 'Немає полів для оновлення');
  }

  const existing = await repo.findById(id);
  if (!existing) throw new AppError(404, 'Батька не знайдено');

  try {
    const parent = await repo.update(id, data);
    return toParentDto(parent);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Батька не знайдено');
    throw err;
  }
}

async function deleteParent(rawId) {
  const id = parseId(rawId);

  const existing = await repo.findById(id);
  if (!existing) throw new AppError(404, 'Батька не знайдено');

  if ((await repo.countChildren(id)) > 0) {
    throw new AppError(409, 'Неможливо видалити батька: до нього прив\'язані діти');
  }

  try {
    await repo.remove(id);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Батька не знайдено');
    throw err;
  }
}

module.exports = { listParents, getParent, createParent, updateParent, deleteParent, toParentDto };