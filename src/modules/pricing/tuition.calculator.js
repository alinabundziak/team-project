const { Prisma } = require('@prisma/client');
const cfg = require('../../config/pricing');

const Decimal = Prisma.Decimal;
const HUNDRED = new Decimal(100);

function money(value) {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function toPercent(value, label) {
  let p;
  try {
    p = new Decimal(value);
  } catch {
    throw new RangeError(`${label} має бути числом`);
  }
  if (!p.isFinite() || p.lt(0) || p.gt(100)) {
    throw new RangeError(`${label} має бути від 0 до 100`);
  }
  return p;
}

function toBaseFee(value) {
  let b;
  try {
    b = new Decimal(value);
  } catch {
    throw new RangeError('baseFee має бути числом');
  }
  if (!b.isFinite() || b.lte(0)) {
    throw new RangeError('baseFee має бути більше нуля');
  }
  return b;
}

function keepFactor(percent) {
  return HUNDRED.minus(percent).div(HUNDRED);
}

function calculateTuition({ baseFee, discountPercent, period }) {
  const base = toBaseFee(baseFee);
  const pct = toPercent(discountPercent, 'discountPercent');

  if (period === 'MONTHLY') {
    const total = money(base.times(keepFactor(pct)));
    return {
      period,
      baseFee: money(base).toFixed(2),
      discountPercent: pct.toFixed(2),
      discountAmount: money(base).minus(total).toFixed(2),
      total: total.toFixed(2),
    };
  }

  if (period === 'ANNUAL') {
    const months = new Decimal(cfg.MONTHS_IN_YEAR);
    const annualPct = toPercent(cfg.ANNUAL_PAYMENT_DISCOUNT_PERCENT, 'annualPaymentDiscountPercent');

    const gross = base.times(months);                       // 15000 * 12
    const afterBenefit = gross.times(keepFactor(pct));      // спочатку пільга
    const total = money(afterBenefit.times(keepFactor(annualPct))); // потім 12%

    return {
      period,
      baseFee: money(base).toFixed(2),
      months: cfg.MONTHS_IN_YEAR,
      discountPercent: pct.toFixed(2),
      annualPaymentDiscountPercent: annualPct.toFixed(2),
      grossAmount: money(gross).toFixed(2),
      amountAfterDiscount: money(afterBenefit).toFixed(2),
      annualDiscountAmount: money(afterBenefit).minus(total).toFixed(2),
      total: total.toFixed(2),
    };
  }

  throw new RangeError("period має бути 'MONTHLY' або 'ANNUAL'");
}

module.exports = { calculateTuition };