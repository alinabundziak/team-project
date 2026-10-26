const { Prisma } = require('@prisma/client');
const repo = require('./payments.repository');
const childrenRepo = require('../children/children.repository');
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

async function createPayment(rawChildId, input) {
  const childId = parseId(rawChildId, 'childId');
  const amount = parseMoney(input.amount, 'amount');

  const child = await childrenRepo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  try {
    const formattedAmount = amount.toFixed(2);
    const payment = await repo.create({
      child_id: childId,
      amount: formattedAmount,
    });
    return toPaymentDto(payment);
  } catch (err) {
    if (err.code === 'P2003') throw new AppError(404, 'Дитину не знайдено');
    throw err;
  }
}

module.exports = { createPayment };