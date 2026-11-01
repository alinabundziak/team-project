const repo = require('./children.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parseDateOnly, todayUtc, calculateAge, formatDateOnly } = require('../../utils/age');
const rules = require('../../config/childrenRules');
const { validateName } = require('../../utils/validators');
const { parsePagination } = require('../../utils/pagination');
const { assertChildAccess, getOwnParentId } = require('./children.access');
const { assertGroupHasCapacity } = require('../groups/groupCapacity.service');
const { normalizeParentNote } = require('./children.validators');


function toChildDto(child) {
  return {
    id: child.id,
    firstName: child.first_name,
    lastName: child.last_name,
    dateOfBirth: formatDateOnly(child.birth_date),
    age: calculateAge(child.birth_date),
    groupId: child.group_id,
    parentIds: (child.child_parents || []).map((l) => l.parent_id).sort((a, b) => a - b),
    parentNote: child.parent_note,
  };
}

function validateBirthDate(value) {
  const date = parseDateOnly(value);
  if (!date) {
    throw new AppError(400, 'dateOfBirth РјР°С” Р±СѓС‚Рё РєРѕСЂРµРєС‚РЅРѕСЋ РґР°С‚РѕСЋ Сѓ С„РѕСЂРјР°С‚С– YYYY-MM-DD');
  }
  const today = todayUtc();
  if (date > today) {
    throw new AppError(400, 'Р”Р°С‚Р° РЅР°СЂРѕРґР¶РµРЅРЅСЏ РЅРµ РјРѕР¶Рµ Р±СѓС‚Рё РІ РјР°Р№Р±СѓС‚РЅСЊРѕРјСѓ');
  }
  const age = calculateAge(date, today);
  if (age < rules.MIN_AGE_YEARS || age > rules.MAX_AGE_YEARS) {
    throw new AppError(
      400,
      `Р’С–Рє РґРёС‚РёРЅРё РјР°С” Р±СѓС‚Рё РІС–Рґ ${rules.MIN_AGE_YEARS} РґРѕ ${rules.MAX_AGE_YEARS} СЂРѕРєС–РІ (Р·Р°СЂР°Р·: ${age})`
    );
  }
  return date;
}

async function resolveGroupId(value) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, 'groupId РјР°С” Р±СѓС‚Рё С†С–Р»РёРј РґРѕРґР°С‚РЅРёРј С‡РёСЃР»РѕРј Р°Р±Рѕ null');
  }
  const group = await repo.findGroupById(value);
  if (!group) {
    throw new AppError(404, 'Р“СЂСѓРїСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
  }
  return value;
}

async function assertChildAgeMatchesGroup(groupId, birthDate) {
  const group = await repo.findGroupById(groupId);

  if (!group) {
    throw new AppError(404, 'Р“СЂСѓРїСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
  }

  const childAge = calculateAge(birthDate);

  if (childAge !== group.target_age) {
    throw new AppError(409, 'Р’С–Рє РґРёС‚РёРЅРё РЅРµ РІС–РґРїРѕРІС–РґР°С” РІС–РєСѓ РіСЂСѓРїРё');
  }
}

async function listChildren(query = {}) {
  const { page, limit } = parsePagination(query);

  const where = {};
  if (query.groupId !== undefined) {
    where.group_id = parseId(query.groupId, 'groupId');
  }
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > rules.MAX_NAME_LENGTH) {
      throw new AppError(400, 'РќРµРєРѕСЂРµРєС‚РЅРёР№ РїР°СЂР°РјРµС‚СЂ search');
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

async function listMyChildren(user, query = {}) {
  const parentId = await getOwnParentId(user.id);
  if (parentId === null) {
    throw new AppError(404, 'РџСЂРѕС„С–Р»СЊ Р±Р°С‚СЊРєР° РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
  }

  const { page, limit } = parsePagination(query);
  const where = { child_parents: { some: { parent_id: parentId } } };

  const [items, total] = await Promise.all([
    repo.findMany({ where, skip: (page - 1) * limit, take: limit }),
    repo.count(where),
  ]);

  return { data: items.map(toChildDto), meta: { page, limit, total } };
}

async function getChild(rawId, user) {
  const id = parseId(rawId);
  const child = await assertChildAccess(user, id);
  return toChildDto(child);
}

async function createChild(input) {
  const data = {
    first_name: validateName(input.firstName, "Р†Рј'СЏ"),
    last_name: validateName(input.lastName, 'РџСЂС–Р·РІРёС‰Рµ'),
    birth_date: validateBirthDate(input.dateOfBirth),
    group_id: input.groupId === undefined ? null : await resolveGroupId(input.groupId),
  };

  if (data.group_id !== null) {
    await assertChildAgeMatchesGroup(data.group_id, data.birth_date);
    await assertGroupHasCapacity(data.group_id);
  }

  const child = await repo.create(data);
  return toChildDto(child);
}

async function updateChild(rawId, input) {
  const id = parseId(rawId);

  const data = {};
  if (input.firstName !== undefined) data.first_name = validateName(input.firstName, "Р†Рј'СЏ");
  if (input.lastName !== undefined) data.last_name = validateName(input.lastName, 'РџСЂС–Р·РІРёС‰Рµ');
  if (input.dateOfBirth !== undefined) data.birth_date = validateBirthDate(input.dateOfBirth);
  if (input.groupId !== undefined) data.group_id = await resolveGroupId(input.groupId);

  if (Object.keys(data).length === 0) {
    throw new AppError(400, 'РќРµРјР°С” РїРѕР»С–РІ РґР»СЏ РѕРЅРѕРІР»РµРЅРЅСЏ');
  }

  const existing = await repo.findById(id);
  if (!existing) throw new AppError(404, 'Р”РёС‚РёРЅСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');

  const effectiveGroupId =
    data.group_id !== undefined ? data.group_id : existing.group_id;

  const effectiveBirthDate =
    data.birth_date !== undefined ? data.birth_date : existing.birth_date;

  if (
    effectiveGroupId !== null &&
    effectiveGroupId !== undefined &&
    (data.group_id !== undefined || data.birth_date !== undefined)
  ) {
    await assertChildAgeMatchesGroup(
      effectiveGroupId,
      effectiveBirthDate
    );
  }

  if (
    data.group_id !== undefined &&
    data.group_id !== null &&
    data.group_id !== existing.group_id
  ) {
    await assertGroupHasCapacity(data.group_id, id);
  }

  try {
    const child = await repo.update(id, data);
    return toChildDto(child);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Р”РёС‚РёРЅСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
    if (err.code === 'P2003') throw new AppError(404, 'Р“СЂСѓРїСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
    throw err;
  }
}

async function deleteChild(rawId) {
  const id = parseId(rawId);

  const existing = await repo.findById(id);
  if (!existing) throw new AppError(404, 'Р”РёС‚РёРЅСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');

    if ((await repo.countSubscriptions(id)) > 0 || (await repo.countCharges(id)) > 0) {
    throw new AppError(409, 'РќРµРјРѕР¶Р»РёРІРѕ РІРёРґР°Р»РёС‚Рё РґРёС‚РёРЅСѓ: С” РїРѕРІ\'СЏР·Р°РЅС– РїС–РґРїРёСЃРєРё/РЅР°СЂР°С…СѓРІР°РЅРЅСЏ');
  }

  try {
    await repo.remove(id);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Р”РёС‚РёРЅСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
    if (err.code === 'P2003') throw new AppError(409, 'РќРµРјРѕР¶Р»РёРІРѕ РІРёРґР°Р»РёС‚Рё РґРёС‚РёРЅСѓ: С” РїРѕРІ\'СЏР·Р°РЅС– С„С–РЅР°РЅСЃРѕРІС– Р·Р°РїРёСЃРё');
    throw err;
  }
}

async function updateParentNote(rawId, input, user) {
  const id = parseId(rawId);
  const note = normalizeParentNote(input.parentNote);

  await assertChildAccess(user, id);

  try {
    const child = await repo.update(id, { parent_note: note });
    return toChildDto(child);
  } catch (err) {
    if (err.code === 'P2025') throw new AppError(404, 'Р”РёС‚РёРЅСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ');
    throw err;
  }
}

module.exports = { listChildren, listMyChildren, getChild, createChild, updateChild, deleteChild, toChildDto, updateParentNote};