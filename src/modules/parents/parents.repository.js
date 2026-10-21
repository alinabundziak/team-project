const prisma = require('../../config/prisma');

const withEmail = { users: { select: { email: true } } };

function findMany({ where, skip, take }) {
  return prisma.parents.findMany({
    where,
    skip,
    take,
    include: withEmail,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { id: 'asc' }],
  });
}

function count(where) {
  return prisma.parents.count({ where });
}

function findById(id) {
  return prisma.parents.findUnique({ where: { id }, include: withEmail });
}

function findByUserId(userId) {
  return prisma.parents.findUnique({ where: { user_id: userId } });
}

function create(data) {
  return prisma.parents.create({ data, include: withEmail });
}

function update(id, data) {
  return prisma.parents.update({ where: { id }, data, include: withEmail });
}

function remove(id) {
  return prisma.parents.delete({ where: { id } });
}

function countChildren(parentId) {
  return prisma.children.count({ where: { parent_id: parentId } });
}

module.exports = {
  findMany,
  count,
  findById,
  findByUserId,
  create,
  update,
  remove,
  countChildren,
};