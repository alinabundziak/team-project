const prisma = require('../../config/prisma');

function create(data) {
  return prisma.adjustments.create({ data });
}

function findManyByCharge(chargeId) {
  return prisma.adjustments.findMany({ where: { charge_id: chargeId } });
}

function findManyByChild(childId) {
  return prisma.adjustments.findMany({ where: { charges: { child_id: childId } } });
}

async function sumByChild(childId) {
  const rows = await prisma.adjustments.groupBy({
    by: ['direction'],
    where: { charges: { child_id: childId } },
    _sum: { amount: true },
  });
  const pick = (direction) => {
    const row = rows.find((r) => r.direction === direction);
    return row ? row._sum.amount : 0;
  };
  return { increase: pick('INCREASE'), decrease: pick('DECREASE') };
}

module.exports = { create, findManyByCharge, findManyByChild, sumByChild };