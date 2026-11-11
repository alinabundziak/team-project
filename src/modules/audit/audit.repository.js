
const prisma = require('../../config/prisma');

function findMany({ where, skip, take }) {
  return prisma.audit_logs.findMany({
    where,
    skip,
    take,
    orderBy: [
      { changed_at: 'desc' },
      { id: 'desc' },
    ],
  });
}

function count(where) {
  return prisma.audit_logs.count({ where });
}

module.exports = {
  findMany,
  count,
};
