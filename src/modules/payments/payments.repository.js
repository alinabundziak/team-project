const prisma = require('../../config/prisma');

function create(data) {
  return prisma.payments.create({ data });
}

function findById(id) {
  return prisma.payments.findUnique({ where: { id } });
}

async function sumByChild(childId) {
  const res = await prisma.payments.aggregate({
    where: { child_id: childId },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

function findManyByChild(childId) {
  return prisma.payments.findMany({ where: { child_id: childId } });
}

module.exports = { create, findById, sumByChild, findManyByChild };