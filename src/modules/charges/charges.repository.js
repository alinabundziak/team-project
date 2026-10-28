const prismaImport = require('../../config/prisma');
const prisma = prismaImport.prisma || prismaImport.default || prismaImport;

function create(data) {
  return prisma.charge.create({ data });
}

function findMany({ where, skip, take }) {
  return prisma.charge.findMany({
    where,
    skip,
    take,
    orderBy: [{ period: 'desc' }, { id: 'desc' }],
  });
}

function count(where) {
  return prisma.charge.count({ where });
}

async function sumTotalByChild(childId) {
  const res = await prisma.charge.aggregate({
    where: { child_id: Number(childId) },
    _sum: { total_amount: true },
  });
  return res._sum.total_amount ?? 0;
}

function findById(id) {
  return prisma.charge.findUnique({ where: { id: Number(id) } });
}

module.exports = { create, findById, findMany, count, sumTotalByChild };