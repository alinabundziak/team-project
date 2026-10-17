const { Prisma } = require('@prisma/client');

const Decimal = Prisma.Decimal;

function amount(value, label) {
  const d = new Decimal(value);
  if (!d.isFinite() || d.lt(0)) {
    throw new RangeError(`${label} має бути числом від 0`);
  }
  return d;
}

function calculateDebt({
  charged,
  adjustmentsIncrease = 0,
  adjustmentsDecrease = 0,
  paid = 0,
  refunded = 0,
}) {
  const a = amount(charged, 'charged');
  const inc = amount(adjustmentsIncrease, 'adjustmentsIncrease');
  const dec = amount(adjustmentsDecrease, 'adjustmentsDecrease');
  const p = amount(paid, 'paid');
  const r = amount(refunded, 'refunded');

  const d = a.plus(inc).minus(dec).minus(p).plus(r);
  const zero = new Decimal(0);

  return {
    charged: a.toFixed(2),
    adjustmentsIncrease: inc.toFixed(2),
    adjustmentsDecrease: dec.toFixed(2),
    paid: p.toFixed(2),
    refunded: r.toFixed(2),
    debt: Decimal.max(d, zero).toFixed(2), 
    overpayment: Decimal.max(d.negated(), zero).toFixed(2),
  };
}

module.exports = { calculateDebt };