const prisma = require('../../config/prisma');

function create(data) {
  return prisma.payments.create({
    data,
  });
}

function findById(id) {
  return prisma.payments.findUnique({
    where: { id: Number(id) },
<<<<<<< HEAD
=======
  });
}

async function sumByChild(childId, tx = prisma) {
  const res = await tx.payments.aggregate({
    where: { child_id: Number(childId) },
    _sum: { amount: true },
>>>>>>> 02bfe715c157cced389f2f4c1c726deb6a5e4c65
  });
}

<<<<<<< HEAD
module.exports = {
  create,
  findById,
=======
function findManyByChild(childId, tx = prisma) {
  return tx.payments.findMany({
    where: { child_id: Number(childId) },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });
}

module.exports = {
  create,
  findById,
  sumByChild,
  findManyByChild,
>>>>>>> 02bfe715c157cced389f2f4c1c726deb6a5e4c65
};