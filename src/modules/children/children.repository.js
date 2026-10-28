const prisma = require('../../config/prisma');

function findMany({ where, skip, take }) {
  return prisma.child.findMany({
    where,
    skip,
    take,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { id: 'asc' }],
  });
}

function count(where) {
  return prisma.child.count({ where });
}

function findById(id) {
  return prisma.child.findUnique({ where: { id: Number(id) } });
}

function create(data) {
  return prisma.child.create({ data });
}

function update(id, data) {
  return prisma.child.update({ where: { id: Number(id) }, data });
}

function remove(id) {
  return prisma.child.delete({ where: { id: Number(id) } });
}

function findGroupById(id) {
  return prisma.group.findUnique({ where: { id: Number(id) } });
}

function countSubscriptions(childId) {
  return prisma.subscription.count({ where: { child_id: Number(childId) } });
}

function findParentByUserId(userId) {
  return prisma.parent.findUnique({ where: { user_id: Number(userId) } });
}

function countCharges(childId) {
  return prisma.charge.count({ where: { child_id: Number(childId) } });
}

module.exports = {
  findMany,
  count,
  findById,
  create,
  update,
  remove,
  findGroupById,
  countSubscriptions,
  findParentByUserId,
  countCharges,
};