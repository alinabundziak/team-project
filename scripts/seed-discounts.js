require('dotenv').config();
const prisma = require('../src/config/prisma');

const DISCOUNTS = [
  { name: 'Без знижки', percentage: 0 },
  { name: 'Знижка 10%', percentage: 10 },
  { name: 'Знижка 20%', percentage: 20 },
  { name: 'Знижка 30%', percentage: 30 },
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
      const exists = await prisma.discounts.findFirst({ where: { percentage: d.percentage } });
      if (exists) {
        console.log(`Пропущено (вже є): ${d.percent}%`);
        continue;
      }
      const created = await prisma.discounts.create({ data: d });
      console.log(`Створено: id=${created.id}, ${d.percentage}%`);
    }
  } catch (err) {
    console.error('Помилка:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();