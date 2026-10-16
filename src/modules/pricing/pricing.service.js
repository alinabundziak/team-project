const { Prisma } = require('@prisma/client');
const childrenRepo = require('../children/children.repository');
const discountsRepo = require('../discounts/discounts.repository');
const { isSupportedPercent } = require('../discounts/discounts.service');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const cfg = require('../../config/pricing');
const { calculateTuition } = require('./tuition.calculator');

const Decimal = Prisma.Decimal;
const PERIODS = ['MONTHLY', 'ANNUAL'];

function parsePeriod(value) {
  if (value === undefined) return 'MONTHLY';
  const p = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!PERIODS.includes(p)) {
    throw new AppError(400, `period має бути одним із: ${PERIODS.join(', ')}`);
  }
  return p;
}

async function resolveDiscount(child, overrideId) {
  if (overrideId !== undefined) {
    const d = await discountsRepo.findById(overrideId);
    if (!d) throw new AppError(404, 'Знижку не знайдено');
    return d;
  }
  if (child.discount_id === null) return null; // без знижки
  const d = await discountsRepo.findById(child.discount_id);
  if (!d) throw new AppError(409, 'Знижку дитини не знайдено в довіднику');
  return d;
}

async function estimateTuition(rawChildId, query = {}) {
  const childId = parseId(rawChildId, 'childId');
  const period = parsePeriod(query.period);
  const overrideId =
    query.discountId === undefined ? undefined : parseId(query.discountId, 'discountId');

  const child = await childrenRepo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  const discount = await resolveDiscount(child, overrideId);
  const percent = discount ? new Decimal(discount.percentage) : new Decimal(0);

  if (!isSupportedPercent(percent)) {
    throw new AppError(409, `Непідтримуваний розмір знижки: ${percent.toString()}%. Дозволено: ${cfg.ALLOWED_DISCOUNT_PERCENTS.join(', ')}`);
  }

  const calculation = calculateTuition({
    baseFee: cfg.TUITION_MONTHLY,
    discountPercent: percent,
    period,
  });

  return {
    childId,
    discount: discount ? { id: discount.id, name: discount.name, percent: percent.toNumber() } : null,
    calculation,
  };
}

module.exports = { estimateTuition };