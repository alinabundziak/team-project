const prisma = require('../../config/prisma');

function findAll() {
  return prisma.discounts.findMany({ orderBy: [{ percentage: 'asc' }, { id: 'asc' }] });
}

function findById(id) {
  return prisma.discounts.findUnique({ where: { id } });
}

module.exports = { findAll, findById };