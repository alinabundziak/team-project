const prisma = require('../../config/prisma');

function findMealRateEffective(age, date) {
  return prisma.meal_rates.findFirst({
    where: { age, valid_from: { lte: date } },
    orderBy: { valid_from: 'desc' },
  });
}

module.exports = { findMealRateEffective };