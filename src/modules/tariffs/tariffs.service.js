const repo = require('./tariffs.repository');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parseMoney } = require('../../utils/money');
const { parseDateOnly, todayUtc, startOfMonthUtc, formatDateOnly } = require('../../utils/age');

function toTariffDto(t) {
  return {
    id: t.id,
    code: t.code,
    amount: t.amount.toFixed(2),
    validFrom: formatDateOnly(t.valid_from),
    createdAt: t.created_at,
  };
}

async function listTariffs() {
  const rows = await repo.findAll();
  const today = todayUtc();
  const currentFound = new Set();

  const data = rows.map((t) => {
    let isCurrent = false;
    if (!currentFound.has(t.code) && t.valid_from <= today) {
      isCurrent = true;
      currentFound.add(t.code);
    }
    return { ...toTariffDto(t), isCurrent };
  });

  return { data };
}

async function getTariffAmount(code, periodStart) {
  const tariff = await repo.findEffective(code, periodStart);
  if (!tariff) {
    throw new AppError(409, `Немає чинного тарифу ${code} на ${formatDateOnly(periodStart)}`);
  }
  return tariff.amount;
}

async function updateTariff(rawTariffId, input) {
  const tariffId = parseId(rawTariffId, 'tariffId');
  const amount = parseMoney(input.amount, 'amount');

  const validFrom = parseDateOnly(input.validFrom);
  if (!validFrom || validFrom.getUTCDate() !== 1) {
    throw new AppError(400, 'validFrom має бути першим днем місяця у форматі YYYY-MM-DD');
  }
  if (validFrom < startOfMonthUtc(todayUtc())) {
    throw new AppError(400, 'validFrom не може бути в минулому місяці');
  }

  const tariff = await repo.findById(tariffId);
  if (!tariff) throw new AppError(404, 'Тариф не знайдено');

  const latest = await repo.findLatestByCode(tariff.code);
  if (validFrom <= latest.valid_from) {
    throw new AppError(
      409,
      `Нова версія має починатись пізніше за останню (${formatDateOnly(latest.valid_from)})`
    );
  }

  try {
    const created = await repo.create({
      code: tariff.code,
      amount: amount.toFixed(2),
      valid_from: validFrom,
    });
    return toTariffDto(created);
  } catch (err) {
    if (err.code === 'P2002') throw new AppError(409, 'Версія тарифу з такою датою початку вже існує');
    throw err;
  }
}

module.exports = { listTariffs, getTariffAmount, updateTariff };