const { Prisma } = require('@prisma/client');
const repo = require('./refunds.repository');
const paymentsRepo = require('../payments/payments.repository');
const childrenRepo = require('../children/children.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parseMoney } = require('../../utils/money');

const Decimal = Prisma.Decimal;
const MAX_REASON_LENGTH = 255;

function toRefundDto(r, childId) {
  return {
    id: r.id,
    childId,
    paymentId: r.payment_id,
    amount: r.amount.toFixed(2),
    reason: r.reason,
    createdAt: r.created_at,
  };
}

function parsePaymentId(value) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, 'paymentId має бути цілим додатним числом');
  }
  return value;
}

function parseReason(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length > MAX_REASON_LENGTH) {
    throw new AppError(400, `reason має бути рядком до ${MAX_REASON_LENGTH} символів`);
  }
  return value.trim() || null;
}

async function createRefund(rawChildId, input) {
  const childId = parseId(rawChildId, 'childId');
  const paymentId = parsePaymentId(input.paymentId);
  const amount = parseMoney(input.amount, 'amount');
  const reason = parseReason(input.reason);

  const child = await childrenRepo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  const payment = await paymentsRepo.findById(paymentId);
  if (!payment || payment.child_id !== childId) {
    throw new AppError(404, 'Оплату не знайдено');
  }

  if (payment.status && payment.status !== 'PAID' && payment.status !== 'COMPLETED') {
    throw new AppError(409, 'Неможливо виконати повернення коштів за неоплаченим або скасованим платежем');
  }

  const paidBase = (payment.paid_amount !== undefined && payment.paid_amount !== null)
    ? payment.paid_amount
    : payment.amount;

  const actualPaidAmount = new Decimal(paidBase);
  if (actualPaidAmount.lte(0)) {
    throw new AppError(409, 'Фактично сплачена сума за цим платежем дорівнює 0');
  }

  try {
    const refund = await repo.createWithLimitCheck(
      paymentId,
      amount,
      actualPaidAmount,
      {
        payment_id: paymentId,
        amount: amount.toFixed(2),
        reason,
      }
    );
    return toRefundDto(refund, childId);
  } catch (err) {
    if (err.code === 'P2003') throw new AppError(404, 'Оплату не знайдено');
    throw err;
  }
}

module.exports = { createRefund };