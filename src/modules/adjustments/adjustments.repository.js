const prisma = require('../../config/prisma');
const { Prisma } = require('@prisma/client');
const Decimal = Prisma.Decimal;

function create(data, tx = prisma) {
  return tx.adjustment.create({ data });
}

function findManyByCharge(chargeId, tx = prisma) {
  return tx.adjustment.findMany({ where: { charge_id: chargeId } });
}

function findManyByChild(childId, tx = prisma) {
  return tx.adjustment.findMany({ where: { charge: { child_id: childId } } });
}

async function sumByChild(childId, tx = prisma) {
  const rows = await tx.adjustment.groupBy({
    by: ['direction'],
    where: { charge: { child_id: childId } },
    _sum: { amount: true },
  });
  const pick = (direction) => {
    const row = rows.find((r) => r.direction === direction);
    return row ? row._sum.amount : 0;
  };
  return { increase: pick('INCREASE'), decrease: pick('DECREASE') };
}

async function createWithLimitCheck(chargeId, direction, amountDecimal, data, initialChargeTotal) {
  return await prisma.$transaction(async (tx) => {
    if (direction === 'DECREASE') {
      const existing = await tx.adjustment.findMany({ where: { charge_id: chargeId } });
      const effective = existing.reduce(
        (sum, a) => (a.direction === 'INCREASE' ? sum.plus(new Decimal(a.amount)) : sum.minus(new Decimal(a.amount))),
        new Decimal(initialChargeTotal)
      );

      if (amountDecimal.gt(effective)) {
        const AppError = require('../../utils/AppError');
        throw new AppError(409, `Зменшення перевищує чинну суму нарахування (${effective.toFixed(2)})`);
      }
    }

    return await tx.adjustment.create({ data });
  });
}

module.exports = { create, findManyByCharge, findManyByChild, sumByChild, createWithLimitCheck };