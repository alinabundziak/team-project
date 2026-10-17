const prisma = require('../../config/prisma');

function create(data) {
  return prisma.refunds.create({ data });
}

async function sumByPayment(paymentId) {
  const res = await prisma.refunds.aggregate({
    where: { payment_id: paymentId },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

async function sumByChild(childId) {
  const res = await prisma.refunds.aggregate({
    where: { payments: { child_id: childId } },
    _sum: { amount: true },
  });
  return res._sum.amount ?? 0;
}

module.exports = { create, sumByPayment, sumByChild };