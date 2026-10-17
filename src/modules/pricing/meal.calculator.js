const { Prisma } = require('@prisma/client');
const cfg = require('../../config/pricing');

const Decimal = Prisma.Decimal;

function money(value) {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function mealPricePerDay(age) {
  if (!Number.isInteger(age) || age < cfg.MEAL_MIN_AGE || age > cfg.MEAL_MAX_AGE) {
    throw new RangeError(`Вік має бути від ${cfg.MEAL_MIN_AGE} до ${cfg.MEAL_MAX_AGE}`);
  }
  const step = new Decimal(cfg.MEAL_DAILY_STEP).times(age - cfg.MEAL_MIN_AGE);
  return money(new Decimal(cfg.MEAL_DAILY_BASE).plus(step));
}

function mealPriceForDays(age, days) {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError('Кількість днів має бути цілим числом від 0');
  }
  return money(mealPricePerDay(age).times(days));
}

function mealPriceForMonth(age) {
  return mealPriceForDays(age, cfg.MEAL_DAYS_PER_MONTH);
}

module.exports = { mealPricePerDay, mealPriceForDays, mealPriceForMonth };