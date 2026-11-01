const { Prisma } = require('@prisma/client');
const repo = require('./discounts.repository');
const cfg = require('../../config/pricing');

const Decimal = Prisma.Decimal;
const ALLOWED = cfg.ALLOWED_DISCOUNT_PERCENTS.map((p) => new Decimal(p));

function isSupportedPercent(percent) {
  const p = new Decimal(percent);
  return ALLOWED.some((a) => a.equals(p));
}

function toDiscountDto(d) {
  return {
    id: d.id,
    code: d.code || null,
    name: d.description || (d.code ? d.code : `Знижка ${d.percent}%`),
    percent: new Decimal(d.percent).toNumber(),
  };
}

async function listDiscounts() {
  const rows = await repo.findAll();

  return {
    data: rows
      .filter((d) => isSupportedPercent(d.percent))
      .map(toDiscountDto),
  };
}

module.exports = { listDiscounts, isSupportedPercent, toDiscountDto };