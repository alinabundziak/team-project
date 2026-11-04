const prismaImport = require('../../config/prisma');
const prisma = prismaImport.prisma || prismaImport.default || prismaImport;

const CHARGE_SELECT = {id: true, child_id: true, period: true, base_fee: true, discount_percent: true, tuition_amount: true, meal_price_per_day: true, meal_days: true, meal_amount: true, total_amount: true, created_at: true,};

function create(data) {
  return prisma.charges.create({ data, select: CHARGE_SELECT });
}

function findMany({ where, skip, take }) {
  return prisma.charges.findMany({
    where,
    skip,
    take,
    select: CHARGE_SELECT,
    orderBy: [{ period: 'desc' }, { id: 'desc' }],
  });
}

function count(where) {
  return prisma.charges.count({ where });
}

async function sumTotalByChild(childId) {
  const res = await prisma.charges.aggregate({
    where: { child_id: Number(childId) },
    _sum: { total_amount: true },
  });
  return res._sum.total_amount ?? 0;
}

function findById(id) {
  return prisma.charges.findUnique({
    where: { id: Number(id) },
    select: CHARGE_SELECT,
  });
}

module.exports = { create, findById, findMany, count, sumTotalByChild };