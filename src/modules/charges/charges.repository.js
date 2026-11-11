const prismaImport = require('../../config/prisma');
const prisma = prismaImport.prisma || prismaImport.default || prismaImport;
<<<<<<< HEAD

function create(data) {
  return prisma.charge.create({ data });
=======

const CHARGE_SELECT = {id: true, child_id: true, period: true, base_fee: true, discount_percent: true, tuition_amount: true, meal_price_per_day: true, meal_days: true, meal_amount: true, total_amount: true, created_at: true,};

function create(data) {
  return prisma.charges.create({ data, select: CHARGE_SELECT });
>>>>>>> 02bfe715c157cced389f2f4c1c726deb6a5e4c65
}

function findMany({ where, skip, take }) {
  return prisma.charge.findMany({
    where,
    skip,
    take,
    select: CHARGE_SELECT,
    orderBy: [{ period: 'desc' }, { id: 'desc' }],
  });
}

function count(where) {
  return prisma.charge.count({ where });
}

async function sumTotalByChild(childId) {
<<<<<<< HEAD
  const res = await prisma.charge.aggregate({
=======
  const res = await prisma.charges.aggregate({
>>>>>>> 02bfe715c157cced389f2f4c1c726deb6a5e4c65
    where: { child_id: Number(childId) },
    _sum: { total_amount: true },
  });
  return res._sum.total_amount ?? 0;
}

function findById(id) {
<<<<<<< HEAD
  return prisma.charge.findUnique({ where: { id: Number(id) } });
=======
  return prisma.charges.findUnique({
    where: { id: Number(id) },
    select: CHARGE_SELECT,
  });
>>>>>>> 02bfe715c157cced389f2f4c1c726deb6a5e4c65
}

module.exports = { create, findById, findMany, count, sumTotalByChild };