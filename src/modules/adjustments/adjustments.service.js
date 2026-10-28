const { Prisma } = require('@prisma/client');
const repo = require('./adjustments.repository');
const chargesRepo = require('../charges/charges.repository');
const childrenRepo = require('../children/children.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parseMoney } = require('../../utils/money');

const Decimal = Prisma.Decimal;
const DIRECTIONS = ['INCREASE', 'DECREASE'];
const MAX_REASON_LENGTH = 255;

function toAdjustmentDto(a, childId) {
  return {
    id: a.id,
    childId,
    chargeId: a.charge_id,
    direction: a.direction,
    amount: a.amount.toFixed(2),
    reason: a.reason,
    createdBy: a.created_by,
    createdAt: a.created_at,
  };
}

function parseChargeId(value) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, 'chargeId має бути цілим додатним числом');
  }
  return value;
}

function parseDirection(value) {
  const d = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!DIRECTIONS.includes(d)) {
    throw new AppError(400, `direction має бути одним із: ${DIRECTIONS.join(', ')}`);
  }
  return d;
}

function parseReason(value) {
  const r = typeof value === 'string' ? value.trim() : '';
  if (!r || r.length > MAX_REASON_LENGTH) {
    throw new AppError(400, `reason є обов'язковим і має бути до ${MAX_REASON_LENGTH} символів`);
  }
  return r;
}

async function createAdjustment(rawChildId, input, authorId) {
  const childId = parseId(rawChildId, 'childId');
  const chargeId = parseChargeId(input.chargeId);
  const direction = parseDirection(input.direction);
  const amount = parseMoney(input.amount, 'amount');
  const reason = parseReason(input.reason);

  const child = await childrenRepo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  const charge = await chargesRepo.findById(chargeId);
  if (!charge || charge.child_id !== childId) {
    throw new AppError(404, 'Нарахування не знайдено');
  }

  try {
    const adjustment = await repo.createWithLimitCheck(
      chargeId,
      direction,
      amount,
      {
        charge_id: chargeId,
        direction,
        amount: amount.toFixed(2),
        reason,
        created_by: authorId,
      },
      charge.total_amount
    );
    return toAdjustmentDto(adjustment, childId);
  } catch (err) {
    if (err.code === 'P2003') throw new AppError(404, 'Нарахування не знайдено');
    throw err;
  }
}

module.exports = { createAdjustment };