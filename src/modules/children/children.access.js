const repo = require('./children.repository');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/roles');

async function getOwnParentId(userId) {
  const parent = await repo.findParentByUserId(userId);
  return parent ? parent.id : null;
}

async function assertChildAccess(user, childId) {
  const child = await repo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) {
    return child;
  }

  if (user.role === ROLES.PARENT) {
    const ownParentId = await getOwnParentId(user.id);
    if (ownParentId !== null && child.parent_id === ownParentId) {
      return child;
    }
  }

  throw new AppError(404, 'Дитину не знайдено');
}

module.exports = { assertChildAccess, getOwnParentId };