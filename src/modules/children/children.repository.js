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
  return prisma.children.findMany({
    where,
    skip,
    take,
    select: childSelect,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }, { id: 'asc' }],
  });
}

function count(where) {
  return prisma.children.count({ where });
}

function findById(id) {
  return prisma.children.findUnique({
    where: { id: Number(id) },
    select: childSelect,
  });
}

function create(data) {
  return prisma.children.create({
    data,
    select: childSelect,
  });
}

function update(id, data) {
  return prisma.children.update({
    where: { id: Number(id) },
    data,
    select: childSelect,
  });
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

function findParentByUserId(userId) {
  return prisma.parents.findUnique({
    where: { user_id: Number(userId) },
    select: parentSelect,
  });
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

function countCharges(childId) {
  return prisma.charges.count({ where: { child_id: Number(childId) } });
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
  hasParentAccess,
  countCharges,
};