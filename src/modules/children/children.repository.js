const prisma = require('../../config/prisma');

const childSelect = {
  id: true,
  first_name: true,
  last_name: true,
  birth_date: true,
  group_id: true,
  discount_id: true,
  parent_note: true,
};

const parentSelect = {
  id: true,
  user_id: true,
  first_name: true,
  last_name: true,
  phone: true,
};

function findMany({ where, skip, take }) {
  return prisma.child.findMany({
    where,
    skip,
    take,
    select: childSelect,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { id: 'asc' }],
  });
}

function count(where) {
  return prisma.child.count({ where });
}

function findById(id) {
  return prisma.child.findUnique({
    where: { id: Number(id) },
    select: childSelect,
  });
}

function create(data) {
  return prisma.child.create({
    data,
    select: childSelect,
  });
}

function update(id, data) {
  return prisma.child.update({
    where: { id: Number(id) },
    data,
    select: childSelect,
  });
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
  return prisma.parent.findUnique({
    where: { user_id: Number(userId) },
    select: parentSelect,
  });
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