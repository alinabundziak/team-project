const prisma = require('../../config/prisma');

function create(data) {
  return prisma.payments.create({
    data,
  });
}

function findById(id) {
  return prisma.payments.findUnique({
    where: { id: Number(id) },
  });
}

async function sumByChild(childId, tx = prisma) {
  const res = await tx.payments.aggregate({
    where: { child_id: Number(childId) },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

function findManyByChild(childId, tx = prisma) {
  return tx.payments.findMany({
    where: { child_id: Number(childId) },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
}

module.exports = {
  create,
  findById,
  sumByChild,
  findManyByChild,
};