const repo = require('./children.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parseDateOnly, todayUtc, calculateAge, formatDateOnly } = require('../../utils/age');
const rules = require('../../config/childrenRules');
const { validateName } = require('../../utils/validators');
const { parsePagination } = require('../../utils/pagination');

// Єдиний формат дитини назовні (контракт для Dev 2 і Dev 4)
function toChildDto(child) {
  return {
    id: child.id,
    firstName: child.first_name,
    lastName: child.last_name,
    dateOfBirth: formatDateOnly(child.birth_date),
    age: calculateAge(child.birth_date),
    groupId: child.group_id,
  };
}

function validateBirthDate(value) {
  const date = parseDateOnly(value);
  if (!date) {
    throw new AppError(400, 'dateOfBirth має бути коректною датою у форматі YYYY-MM-DD');
  }
  const today = todayUtc();
  if (date > today) {
    throw new AppError(400, 'Дата народження не може бути в майбутньому');
  }
  const age = calculateAge(date, today);
  if (age < rules.MIN_AGE_YEARS || age > rules.MAX_AGE_YEARS) {
    throw new AppError(
      400,
      `Вік дитини має бути від ${rules.MIN_AGE_YEARS} до ${rules.MAX_AGE_YEARS} років (зараз: ${age})`
    );
  }
  return date;
}

async function resolveGroupId(value) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, 'groupId має бути цілим додатним числом або null');
  }
  const group = await repo.findGroupById(value);
  if (!group) {
    throw new AppError(404, 'Групу не знайдено');
  }
  return value;
}

async function listChildren(query = {}) {
  const { page, limit } = parsePagination(query);

  const where = {};
  if (query.groupId !== undefined) {
    where.group_id = parseId(query.groupId, 'groupId');
  }
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > rules.MAX_NAME_LENGTH) {
      throw new AppError(400, 'Некоректний параметр search');
    }
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { first_name: { contains: s, mode: 'insensitive' } },
        { last_name: { contains: s, mode: 'insensitive' } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    repo.findMany({ where, skip: (page - 1) * limit, take: limit }),
    repo.count(where),
  ]);

  return { data: items.map(toChildDto), meta: { page, limit, total } };
}

async function getChild(rawId) {
  const id = parseId(rawId);
  const child = await repo.findById(id);
  if (!child) throw new AppError(404, 'Дитину не знайдено');
  return toChildDto(child);
}

async function createChild(input) {
  const data = {
    first_name: validateName(input.firstName, "Ім'я"),
    last_name: validateName(input.lastName, 'Прізвище'),
    birth_date: validateBirthDate(input.dateOfBirth),
    group_id: input.groupId === undefined ? null : await resolveGroupId(input.groupId),
  };

  const child = await repo.create(data);
  return toChildDto(child);
}

async function updateChild(rawId, input) {
  const id = parseId(rawId);

  const data = {};
  if (input.firstName !== undefined) data.first_name = validateName(input.firstName, "Ім'я");
  if (input.lastName !== undefined) data.last_name = validateName(input.lastName, 'Прізвище');
  if (input.dateOfBirth !== undefined) data.birth_date = validateBirthDate(input.dateOfBirth);
  if (input.groupId !== undefined) data.group_id = await resolveGroupId(input.groupId);

  if (Object.keys(data).length === 0) {
    throw new AppError(400, 'Немає полів для оновлення');
  }

  const existing = await repo.findById(id);
  if (!existing) throw new AppError(404, 'Дитину не знайдено');

  try {
    const child = await repo.update(id, data);
    return toChildDto(child);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Дитину не знайдено');
    if (err.code === 'P2003') throw new AppError(404, 'Групу не знайдено');
    throw err;
  }
}

async function deleteChild(rawId) {
  const id = parseId(rawId);

  const existing = await repo.findById(id);
  if (!existing) throw new AppError(404, 'Дитину не знайдено');

  if ((await repo.countSubscriptions(id)) > 0) {
    throw new AppError(409, 'Неможливо видалити дитину: є пов\'язані підписки/нарахування');
  }

  try {
    await repo.remove(id);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Дитину не знайдено');
    throw err;
  }
}

module.exports = { listChildren, getChild, createChild, updateChild, deleteChild, toChildDto };