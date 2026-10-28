const prisma = require('../../config/prisma');

function create(data, tx = prisma) {
  return tx.refund.create({ data });
}

async function sumByPayment(paymentId, tx = prisma) {
  const res = await tx.refund.aggregate({
    where: { payment_id: paymentId },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

async function sumByChild(childId, tx = prisma) {
  const res = await tx.refund.aggregate({
    where: { payment: { child_id: childId } },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

function findManyByChild(childId, tx = prisma) {
  return tx.refund.findMany({ where: { payment: { child_id: childId } } });
}

async function createWithLimitCheck(paymentId, amountDecimal, maxAllowedDecimal, data) {
  return await prisma.$transaction(async (tx) => {
    const res = await tx.refund.aggregate({
      where: { payment_id: paymentId },
      _sum: { amount: true },
    });
    const alreadyRefunded = new (require('@prisma/client').Prisma.Decimal)(res._sum.amount ?? 0);
    const available = maxAllowedDecimal.minus(alreadyRefunded);

    if (amountDecimal.gt(available)) {
      const AppError = require('../../utils/AppError');
      throw new AppError(409, `Сума повернення перевищує доступну по цій оплаті (${available.toFixed(2)})`);
    }

    return await tx.refund.create({ data });
  });
}

module.exports = { create, sumByPayment, sumByChild, findManyByChild, createWithLimitCheck };