const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  TEACHER: 'TEACHER',
  PARENT: 'PARENT',
});

const ROLE_LIST = Object.values(ROLES);

module.exports = { ROLES, ROLE_LIST };