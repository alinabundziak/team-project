const prisma = require('../../config/prisma');
const withParents = { child_parents: { select: { parent_id: true } } };

function findMany({ where, skip, take }) {
  return prisma.children.findMany({
    where,
    skip,
    take,
    include: withParents,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { id: 'asc' }],
  });
}

function count(where) {
  return prisma.children.count({ where });
}

function findById(id) {
  return prisma.children.findUnique({ where: { id: Number(id) }, include: withParents });
}

function create(data) {
  return prisma.children.create({ data, include: withParents });
}

function update(id, data) {
  return prisma.children.update({ where: { id: Number(id) }, data, include: withParents });
}

function remove(id) {
  return prisma.children.delete({ where: { id: Number(id) } });
}

function findGroupById(id) {
  return prisma.groups.findUnique({ where: { id: Number(id) } });
}

function countSubscriptions(childId) {
  return prisma.subscriptions.count({ where: { child_id: Number(childId) } });
}

function countCharges(childId) {
  return prisma.charges.count({ where: { child_id: Number(childId) } });
}

function findParentByUserId(userId) {
  return prisma.parents.findUnique({ where: { user_id: Number(userId) } });
}

async function hasParentAccess(childId, parentId) {
  const relation = await prisma.child_parents.findUnique({
    where: {
      child_id_parent_id: {
        child_id: Number(childId),
        parent_id: Number(parentId),
      },
    },
  });
  return Boolean(relation);
}
module.exports = {
  hasParentAccess,
  findMany,
  count,
  findById,
  create,
  update,
  remove,
  findGroupById,
  countSubscriptions,
  countCharges,
  findParentByUserId,
};