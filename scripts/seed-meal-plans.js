require('dotenv').config();
const { Prisma } = require('@prisma/client');
const prisma = require('../src/config/prisma');
const cfg = require('../src/config/pricing');
const { mealPriceForMonth } = require('../src/modules/pricing/meal.calculator');

(async () => {
  try {
    for (let age = cfg.MEAL_MIN_AGE; age <= cfg.MEAL_MAX_AGE; age++) {
      const price = mealPriceForMonth(age);
      const exists = await prisma.meal_plans.findFirst({ where: { age_category: age } });

      if (!exists) {
        await prisma.meal_plans.create({ data: { age_category: age, monthly_price: price } });
        console.log(`Створено: вік ${age} → ${price.toFixed(2)} грн/міс`);
      } else if (!new Prisma.Decimal(exists.monthly_price).equals(price)) {
        console.log(`Вік ${age}: у БД ${exists.monthly_price}, за формулою ${price.toFixed(2)}. Не змінювала`);
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