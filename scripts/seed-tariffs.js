require('dotenv').config();
const prisma = require('../src/config/prisma');
const cfg = require('../src/config/pricing');

const INITIAL_VALID_FROM = new Date(Date.UTC(2026, 8, 1)); // 2026-09-01

(async () => {
  try {
    const exists = await prisma.tariffs.findFirst({ where: { code: cfg.TARIFF_TUITION_CODE } });
    if (exists) {
      console.log('Пропущено: тариф навчання вже існує');
      return;
    }
    const created = await prisma.tariffs.create({
      data: {
        code: cfg.TARIFF_TUITION_CODE,
        amount: cfg.TUITION_MONTHLY,
        valid_from: INITIAL_VALID_FROM,
      },
    });
    console.log(`Створено тариф id=${created.id}: ${cfg.TUITION_MONTHLY} грн з 2026-09-01`);
  } catch (err) {
    console.error('Помилка:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();