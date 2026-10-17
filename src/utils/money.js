const { Prisma } = require('@prisma/client');
const AppError = require('./AppError');

const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

function parseMoney(value, label = 'amount') {
  const s = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  const message = `${label} має бути додатним числом не більше ніж з двома знаками після коми`;

  if (typeof s !== 'string' || !MONEY_RE.test(s.trim())) {
    throw new AppError(400, message);
  }
  const d = new Prisma.Decimal(s.trim());
  if (d.lte(0)) throw new AppError(400, message);
  return d;
}

module.exports = { parseMoney };