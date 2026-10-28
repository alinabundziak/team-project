const { Prisma } = require('@prisma/client');
const repo = require('./payments.repository');
const childrenRepo = require('../children/children.repository');
const { assertChildAccess } = require('../children/children.access');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parseMoney } = require('../../utils/money');

const Decimal = Prisma.Decimal;

function toPaymentDto(p) {
  return {
    id: p.id,
    childId: p.child_id,
    amount: new Decimal(p.amount).toFixed(2),
    createdAt: p.created_at,
  };
}

async function requireChild(rawChildId, user) {
  const childId = parseId(rawChildId, 'childId');
  if (user) {
    const roleName = user.role?.name || user.roleName || user.role;
    if (roleName !== 'ADMIN' && roleName !== 'PARENT') {
      throw new AppError(403, 'У вас немає доступу до фінансових даних');
    }
    return await assertChildAccess(user, childId);
  }
  const child = await childrenRepo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');
  return child;
}

async function createPayment(rawChildId, input, user) {
  const child = await requireChild(rawChildId, user);
  const amount = parseMoney(input.amount, 'amount');

  try {
    const formattedAmount = amount.toFixed(2);
    const payment = await repo.create({
      child_id: child.id,
      amount: formattedAmount,
    });
    return toPaymentDto(payment);
  } catch (err) {
    if (err.code === 'P2003') throw new AppError(404, 'Дитину не знайдено');
    throw err;
  }
}

module.exports = { createPayment };