const prisma = require('../../config/prisma');

function findMealPlanByAge(age) {
  return prisma.meal_plans.findFirst({ where: { age_category: age } });
}

module.exports = { findMealPlanByAge };