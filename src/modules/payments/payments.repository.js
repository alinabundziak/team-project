const prisma = require('../../config/prisma');

function create(data) {
  return prisma.payments.create({
    data,
  });
}

function findById(id) {
  return prisma.payments.findUnique({
    where: { id: Number(id) },
  });
}

module.exports = {
  create,
  findById,
};