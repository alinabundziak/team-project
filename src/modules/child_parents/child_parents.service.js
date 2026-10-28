const repo = require('./child_parents.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { validateIntId } = require('../../utils/validators');

async function linkParent(rawChildId, input) {
  const childId = parseId(rawChildId, 'id');
  validateIntId(input.parentId, 'parentId');
  const parentId = input.parentId;

  if (!(await repo.findChildById(childId))) throw new AppError(404, 'Дитину не знайдено');
  if (!(await repo.findParentById(parentId))) throw new AppError(404, 'Батька не знайдено');

  if (await repo.findLink(childId, parentId)) {
    throw new AppError(409, "Зв'язок між дитиною і цим батьком уже існує");
  }

  try {
    await repo.createLink(childId, parentId);
  } catch (err) {
    if (err.code === 'P2002') throw new AppError(409, "Зв'язок між дитиною і цим батьком уже існує");
    if (err.code === 'P2003') throw new AppError(404, 'Дитину або батька не знайдено');
    throw err;
  }

  return { childId, parentId };
}

async function unlinkParent(rawChildId, rawParentId) {
  const childId = parseId(rawChildId, 'id');
  const parentId = parseId(rawParentId, 'parentId');

  if (!(await repo.findChildById(childId))) throw new AppError(404, 'Дитину не знайдено');

  try {
    await repo.deleteLink(childId, parentId);
  } catch (err) {
    if (err.code === 'P2025') {
      throw new AppError(404, "Зв'язок між дитиною і цим батьком не знайдено");
    }
    throw err;
  }
}

module.exports = { linkParent, unlinkParent };