require('dotenv').config();
const { Prisma } = require('@prisma/client');
const prisma = require('../src/config/prisma');
const cfg = require('../src/config/pricing');
const { dailyRateByFormula } = require('../src/modules/pricing/meal.calculator');

(async () => {
  try {
    for (let age = cfg.MEAL_MIN_AGE; age <= cfg.MEAL_MAX_AGE; age++) {
      const rate = dailyRateByFormula(age);
      const exists = await prisma.meal_rates.findUnique({ where: { age } });

      if (!exists) {
        await prisma.meal_rates.create({ data: { age, daily_rate: rate } });
        console.log(`Створено: вік ${age} → ${rate.toFixed(2)} грн/день`);
      } else if (!new Prisma.Decimal(exists.daily_rate).equals(rate)) {
        console.log(`Вік ${age}: у БД ${exists.daily_rate}, за формулою ${rate.toFixed(2)}. Не змінювала`);
      } else {
        console.log(`Пропущено (вже є): вік ${age}`);
      }
    }
  } catch (err) {
    console.error('Помилка:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();