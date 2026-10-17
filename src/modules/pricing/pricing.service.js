const { Prisma } = require('@prisma/client');
const childrenRepo = require('../children/children.repository');
const discountsRepo = require('../discounts/discounts.repository');
const { isSupportedPercent } = require('../discounts/discounts.service');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const cfg = require('../../config/pricing');
const { calculateTuition } = require('./tuition.calculator');
const pricingRepo = require('./pricing.repository');
const { calculateAge } = require('../../utils/age');
const { getTariffAmount } = require('../tariffs/tariffs.service');
const { mealPriceForDays } = require('./meal.calculator');
const { calculateAge, todayUtc, startOfMonthUtc, formatDateOnly } = require('../../utils/age');

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
  if (child.discount_id === null) return null;
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

  const baseFee = await getTariffAmount(cfg.TARIFF_TUITION_CODE, startOfMonthUtc(todayUtc()));
  const calculation = calculateTuition({
    baseFee,
    discountPercent: percent,
    period,
  });

  return {
    childId,
    discount: discount ? { id: discount.id, name: discount.name, percent: percent.toNumber() } : null,
    calculation,
  };
}

function parseDays(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(400, 'days має бути цілим числом від 1 до 31');
  }
  const n = Number(value);
  if (n < 1 || n > 31) {
    throw new AppError(400, 'days має бути цілим числом від 1 до 31');
  }
  return n;
}

async function calculateMealAmount(age, days, periodStart) {
  const rate = await pricingRepo.findMealRateEffective(age, periodStart);
  if (!rate) {
    throw new AppError(
      409,
      `Немає чинної ціни харчування для віку ${age} на ${formatDateOnly(periodStart)}. Для нарахування без харчування вкажіть mealDays: 0`
    );
  }

  const billedDays = days === undefined ? cfg.MEAL_DAYS_PER_MONTH : days;
  const pricePerDay = new Decimal(rate.daily_rate).toDecimalPlaces(2);

  return {
    pricePerDay,
    days: billedDays,
    total: mealPriceForDays(pricePerDay, billedDays),
  };
}

async function getChildDiscountPercent(child) {
  const discount = await resolveDiscount(child, undefined);
  const percent = discount ? new Decimal(discount.percentage) : new Decimal(0);
  if (!isSupportedPercent(percent)) {
    throw new AppError(409, `Непідтримуваний розмір знижки: ${percent.toString()}%`);
  }
  return percent;
}

async function estimateMeals(rawChildId, query = {}) {
  const childId = parseId(rawChildId, 'childId');
  const days = parseDays(query.days);

  const child = await childrenRepo.findById(childId);
  if (!child) throw new AppError(404, 'Дитину не знайдено');

  const age = calculateAge(child.birth_date);
  const meal = await calculateMealAmount(age, days, startOfMonthUtc(todayUtc()));

  return {
    childId,
    age,
    pricePerDay: meal.pricePerDay.toFixed(2),
    days: meal.days,
    total: meal.total.toFixed(2),
  };
}

module.exports = { estimateTuition, estimateMeals, calculateMealAmount, getChildDiscountPercent };