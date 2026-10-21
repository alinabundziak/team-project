const prisma = require('../../config/prisma');

const withRole = { roles: true };

function findByEmail(email) {
  return prisma.users.findUnique({ where: { email }, include: withRole });
}

function findById(id) {
  return prisma.users.findUnique({ where: { id }, include: withRole });
}

function findRoleByName(name) {
  return prisma.roles.findUnique({ where: { name } });
}

function create({ email, passwordHash, roleId }) {
  return prisma.users.create({
    data: { email, password_hash: passwordHash, role_id: roleId },
    include: withRole,
  });
}

function findAnyByRole(roleName) {
  return prisma.users.findFirst({ where: { roles: { name: roleName } } });
}
module.exports = { findByEmail, findById, findRoleByName, findAnyByRole, create };