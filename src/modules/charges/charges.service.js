const repo = require('./charges.repository');
const pricing = require('../pricing/pricing.service');
const childrenRepo = require('../children/children.repository');
const { calculateTuition } = require('../pricing/tuition.calculator');
const { calculateDebt } = require('../pricing/balance.calculator');
const { Prisma } = require('@prisma/client');
const cfg = require('../../config/pricing');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parsePagination } = require('../../utils/pagination');
const { calculateAge, formatDateOnly } = require('../../utils/age');
const paymentsRepo = require('../payments/payments.repository');
const refundsRepo = require('../refunds/refunds.repository');
const Decimal = Prisma.Decimal;
const { getTariffAmount } = require('../tariffs/tariffs.service');
const adjustmentsRepo = require('../adjustments/adjustments.repository');
const { assertChildAccess } = require('../children/children.access');

function parseMonth(value) {
  const m = typeof value === 'string' ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim()) : null;
  const year = m ? Number(m[1]) : 0;
  if (!m || year < 2000 || year > 2100) {
    throw new AppError(400, 'month має бути у форматі YYYY-MM (наприклад, 2026-10)');
  }
  return new Date(Date.UTC(year, Number(m[2]) - 1, 1));
}

function parseMealDays(value) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 31) {
    throw new AppError(400, 'mealDays має бути цілим числом від 0 до 31');
  }
  return value;
}

function toChargeDto(c) {
  return {
    id: c.id,
    childId: c.child_id,
    month: formatDateOnly(c.period).slice(0, 7),
    baseFee: c.base_fee.toFixed(2),
    discountPercent: c.discount_percent.toFixed(2),
    tuitionAmount: c.tuition_amount.toFixed(2),
    mealPricePerDay: c.meal_price_per_day.toFixed(2),
    mealDays: c.meal_days,
    mealAmount: c.meal_amount.toFixed(2),
    totalAmount: c.total_amount.toFixed(2),
    createdAt: c.created_at,
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

async function createCharge(rawChildId, input, user) {
  const periodStart = parseMonth(input.month);
  const mealDays = parseMealDays(input.mealDays);
  const child = await requireChild(rawChildId, user);

  const discountPercent = await pricing.getChildDiscountPercent(child);
  const baseFee = await getTariffAmount(cfg.TARIFF_TUITION_CODE, periodStart);
  const tuition = calculateTuition({
    baseFee,
    discountPercent,
    period: 'MONTHLY',
  });

  let mealPricePerDay = new Decimal(0);
  let mealAmount = new Decimal(0);
  let billedDays = 0;
  if (mealDays !== 0) {
    const age = calculateAge(child.birth_date, periodStart);
    const meal = await pricing.calculateMealAmount(age, mealDays, periodStart);
    mealPricePerDay = meal.pricePerDay;
    mealAmount = meal.total;
    billedDays = meal.days;
  }

  const total = new Decimal(tuition.total).plus(mealAmount);

  try {
    const charge = await repo.create({
      child_id: child.id,
      period: periodStart,
      base_fee: tuition.baseFee,
      discount_percent: tuition.discountPercent,
      tuition_amount: tuition.total,
      meal_price_per_day: mealPricePerDay.toFixed(2),
      meal_days: billedDays,
      meal_amount: mealAmount.toFixed(2),
      total_amount: total.toFixed(2),
    });
    return toChargeDto(charge);
  } catch (err) {
    if (err.code === 'P2002') throw new AppError(409, 'Нарахування за цей місяць уже існує');
    if (err.code === 'P2003') throw new AppError(404, 'Дитину не знайдено');
    throw err;
  }
}

async function listCharges(rawChildId, query = {}, user) {
  const child = await requireChild(rawChildId, user);
  const { page, limit } = parsePagination(query);
  const where = { child_id: child.id };

  const [items, total] = await Promise.all([
    repo.findMany({ where, skip: (page - 1) * limit, take: limit }),
    repo.count(where),
  ]);

  return { data: items.map(toChargeDto), meta: { page, limit, total } };
}

async function getBalance(rawChildId, user) {
  const child = await requireChild(rawChildId, user);

  const [charged, paid, refunded, adjustments] = await Promise.all([
    repo.sumTotalByChild(child.id),
    paymentsRepo.sumByChild(child.id),
    refundsRepo.sumByChild(child.id),
    adjustmentsRepo.sumByChild(child.id),
  ]);

  const result = calculateDebt({
    charged,
    adjustmentsIncrease: adjustments.increase,
    adjustmentsDecrease: adjustments.decrease,
    paid,
    refunded,
  });

  return { childId: child.id, ...result };
}

async function getFinancialHistory(rawChildId, user) {
  const child = await requireChild(rawChildId, user);

  const [charges, payments, refunds, adjustments] = await Promise.all([
    repo.findMany({ where: { child_id: child.id } }),
    paymentsRepo.findManyByChild(child.id),
    refundsRepo.findManyByChild(child.id),
    adjustmentsRepo.findManyByChild(child.id),
  ]);

  const events = [
    ...charges.map((c) => {
      const dto = toChargeDto(c);
      return {
        type: 'CHARGE',
        id: c.id,
        date: c.created_at,
        amount: dto.totalAmount,
        details: {
          month: dto.month,
          baseFee: dto.baseFee,
          discountPercent: dto.discountPercent,
          tuitionAmount: dto.tuitionAmount,
          mealPricePerDay: dto.mealPricePerDay,
          mealDays: dto.mealDays,
          mealAmount: dto.mealAmount,
        },
      };
    }),
    ...payments.map((p) => {
      const status = p.status || 'PAID';
      const paidAmount = p.paid_amount !== undefined && p.paid_amount !== null
        ? new Decimal(p.paid_amount).toFixed(2)
        : new Decimal(p.amount).toFixed(2);

      return {
        type: 'PAYMENT',
        id: p.id,
        date: p.created_at,
        amount: new Decimal(p.amount).toFixed(2),
        details: {
          status,
          paidAmount,
        },
      };
    }),
    ...refunds.map((r) => ({
      type: 'REFUND',
      id: r.id,
      date: r.created_at,
      amount: new Decimal(r.amount).toFixed(2),
      details: { paymentId: r.payment_id, reason: r.reason },
    })),
    ...adjustments.map((a) => ({
      type: 'ADJUSTMENT',
      id: a.id,
      date: a.created_at,
      amount: new Decimal(a.amount).toFixed(2),
      details: {
        chargeId: a.charge_id,
        direction: a.direction,
        reason: a.reason,
        createdBy: a.created_by,
      },
    })),
  ];

  events.sort((a, b) => b.date - a.date || b.id - a.id);

  return { childId: child.id, data: events };
}

module.exports = { createCharge, listCharges, getBalance, getFinancialHistory };