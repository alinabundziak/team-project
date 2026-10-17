const prisma = require('../../config/prisma');

function findMealRateByAge(age) {
  return prisma.meal_rates.findUnique({ where: { age } });
}

module.exports = { findMealRateByAge };