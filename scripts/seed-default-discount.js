require('dotenv').config();
const prisma = require('../src/config/prisma');

(async () => {
  try {
    const existing = await prisma.discounts.findUnique({ where: { id: 1 } });
    if (existing) {
      console.log('Запис discounts id=1 вже є:', existing);
      return;
    }

    const created = await prisma.discounts.create({
      data: { id: 1, name: 'Без пільги', percentage: 0 },
    });
    console.log('Створено:', created);
  } catch (err) {
    console.error('Помилка:', err.code, err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();