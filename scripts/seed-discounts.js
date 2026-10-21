require('dotenv').config();
const prisma = require('../src/config/prisma');

const DISCOUNTS = [
  { code: 'NONE', description: 'Без знижки', percent: 0 },
  { code: 'DISCOUNT_10', description: 'Знижка 10%', percent: 10 },
  { code: 'DISCOUNT_20', description: 'Знижка 20%', percent: 20 },
  { code: 'DISCOUNT_30', description: 'Знижка 30%', percent: 30 },
];

(async () => {
  try {
    const existing = await prisma.discounts.findMany({ orderBy: { id: 'asc' } });
    console.log(
      'Зараз у таблиці:',
      existing.map((d) => `id=${d.id} (${d.percent}%)`).join(', ') || 'порожньо'
    );

    if (existing.length > 0) {
      await prisma.$queryRaw`
        SELECT setval(pg_get_serial_sequence('discounts', 'id'), (SELECT MAX(id) FROM discounts))
      `;
    }

    for (const d of DISCOUNTS) {
      const exists = await prisma.discounts.findFirst({ where: { percent: d.percent } });
      if (exists) {
        console.log(`Пропущено (вже є): ${d.percent}%`);
        continue;
      }
      const created = await prisma.discounts.create({ data: d });
      console.log(`Створено: id=${created.id}, ${d.percent}%`);
    }
  } catch (err) {
    console.error('Помилка:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();