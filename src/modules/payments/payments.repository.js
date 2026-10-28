const prismaImport = require('../../config/prisma');
const prisma = prismaImport.prisma || prismaImport.default || prismaImport;

function create(data) {
  return prisma.payment.create({ data });
}

function findById(id) {
  return prisma.payment.findUnique({ where: { id: Number(id) } });
}

async function sumByChild(childId) {
  const numericChildId = Number(childId);
  const res = await prisma.payment.aggregate({
    where: { child_id: numericChildId },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

function findManyByChild(childId) {
  return prisma.payment.findMany({ where: { child_id: Number(childId) } });
}

module.exports = { create, findById, sumByChild, findManyByChild };