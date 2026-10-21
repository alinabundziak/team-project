const repo = require('./childParents.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');

function validateParentId(value) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, 'parentId має бути цілим додатним числом');
  }
  return value;
}

async function linkParent(rawChildId, input) {
  const childId = parseId(rawChildId, 'id');
  const parentId = validateParentId(input.parentId);

  const child = await repo.findChildById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  const parent = await repo.findParentById(parentId);
  if (!parent) throw new AppError(404, 'Батька не знайдено');

  if (child.parent_id === parentId) {
    throw new AppError(409, 'Зв\'язок між дитиною і цим батьком уже існує');
  }
  if (child.parent_id !== null) {
    throw new AppError(409, 'У дитини вже є батько/мати');
  }

  let attached;
  try {
    attached = await repo.attach(childId, parentId);
  } catch (err) {
    if (err.code === 'P2003') throw new AppError(404, 'Батька не знайдено');
    throw err;
  }

  if (!attached) {
    const fresh = await repo.findChildById(childId);
    if (!fresh) throw new AppError(404, 'Дитину не знайдено');
    if (fresh.parent_id === parentId) {
      throw new AppError(409, 'Зв\'язок між дитиною і цим батьком уже існує');
    }
    throw new AppError(409, 'У дитини вже є батько/мати. Наразі підтримується один зв\'язок');
  }

  return { childId, parentId };
}

async function unlinkParent(rawChildId, rawParentId) {
  const childId = parseId(rawChildId, 'id');
  const parentId = parseId(rawParentId, 'parentId');

  const child = await repo.findChildById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  const detached = await repo.detach(childId, parentId);
  if (!detached) {
    throw new AppError(404, 'Зв\'язок між дитиною і цим батьком не знайдено');
  }
}

module.exports = { linkParent, unlinkParent };