const prisma = require('../../config/prisma');

function findAll() {
  return prisma.tariffs.findMany({ orderBy: [{ code: 'asc' }, { valid_from: 'desc' }] });
}

function findById(id) {
  return prisma.tariffs.findUnique({ where: { id } });
}

function findEffective(code, date) {
  return prisma.tariffs.findFirst({
    where: { code, valid_from: { lte: date } },
    orderBy: { valid_from: 'desc' },
  });
}

function findLatestByCode(code) {
  return prisma.tariffs.findFirst({ where: { code }, orderBy: { valid_from: 'desc' } });
}

function create(data) {
  return prisma.tariffs.create({ data });
}

module.exports = { findAll, findById, findEffective, findLatestByCode, create };