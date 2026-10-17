const prisma = require('../../config/prisma');

function create(data) {
  return prisma.charges.create({ data });
}

function findMany({ where, skip, take }) {
  return prisma.charges.findMany({
    where,
    skip,
    take,
    orderBy: [{ period: 'desc' }, { id: 'desc' }],
  });
}

function count(where) {
  return prisma.charges.count({ where });
}

async function sumTotalByChild(childId) {
  const res = await prisma.charges.aggregate({
    where: { child_id: childId },
    _sum: { total_amount: true },
  });
  return res._sum.total_amount ?? 0;
}

module.exports = { create, findMany, count, sumTotalByChild };