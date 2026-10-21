const prisma = require('../../config/prisma');

function findMany({ where, skip, take }) {
  return prisma.children.findMany({
    where,
    skip,
    take,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { id: 'asc' }],
  });
}

function count(where) {
  return prisma.children.count({ where });
}

function findById(id) {
  return prisma.children.findUnique({ where: { id } });
}

function create(data) {
  return prisma.children.create({ data });
}

function update(id, data) {
  return prisma.children.update({ where: { id }, data });
}

function remove(id) {
  return prisma.children.delete({ where: { id } });
}

function findGroupById(id) {
  return prisma.groups.findUnique({ where: { id } });
}

function countSubscriptions(childId) {
  return prisma.subscriptions.count({ where: { child_id: childId } });
}

function findParentByUserId(userId) {
  return prisma.parents.findUnique({ where: { user_id: userId } });
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
};