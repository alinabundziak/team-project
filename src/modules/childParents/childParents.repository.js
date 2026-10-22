const prisma = require('../../config/prisma');

function findChildById(id) {
  return prisma.children.findUnique({ where: { id } });
}

function findParentById(id) {
  return prisma.parents.findUnique({ where: { id } });
}

async function attach(childId, parentId) {
  const res = await prisma.children.updateMany({
    where: { id: childId, parent_id: null },
    data: { parent_id: parentId },
  });
  return res.count === 1;
}

async function detach(childId, parentId) {
  const res = await prisma.children.updateMany({
    where: { id: childId, parent_id: parentId },
    data: { parent_id: null },
  });
  return res.count === 1;
}

module.exports = { findChildById, findParentById, attach, detach };