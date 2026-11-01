const prisma = require('../../config/prisma');

const key = (childId, parentId) => ({
  child_id_parent_id: { child_id: childId, parent_id: parentId },
});

function findChildById(id) {
  return prisma.children.findUnique({ where: { id } });
}

function findParentById(id) {
  return prisma.parents.findUnique({ where: { id } });
}

function findLink(childId, parentId) {
  return prisma.child_parents.findUnique({ where: key(childId, parentId) });
}

function createLink(childId, parentId) {
  return prisma.child_parents.create({ data: { child_id: childId, parent_id: parentId } });
}

function deleteLink(childId, parentId) {
  return prisma.child_parents.delete({ where: key(childId, parentId) });
}

module.exports = { findChildById, findParentById, findLink, createLink, deleteLink };