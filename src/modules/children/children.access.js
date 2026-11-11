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

  const userRole = user.role?.name || user.roleName || user.role;

  if (userRole === ROLES.ADMIN || userRole === ROLES.MANAGER) {
    return child;
  }

  if (userRole === ROLES.PARENT) {
    const ownParentId = await getOwnParentId(user.id);
<<<<<<< HEAD
    
=======

>>>>>>> 02bfe715c157cced389f2f4c1c726deb6a5e4c65
    if (ownParentId !== null) {
      const hasAccess = await repo.hasParentAccess(child.id, ownParentId);
      if (hasAccess) {
        return child;
      }
    }
    throw new AppError(403, 'У вас немає доступу до цієї дитини');
  }

  throw new AppError(403, 'У вас немає доступу до фінансових даних');
}

module.exports = { assertChildAccess, getOwnParentId };