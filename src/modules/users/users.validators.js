const AppError = require('../../utils/AppError');
const { ROLE_LIST } = require('../../config/roles');
const { validateEmail, validatePassword } = require('../../utils/validators');

function validateCreateUser(body) {
  validateEmail(body.email);
  validatePassword(body.password);
  if (!ROLE_LIST.includes(body.role)) {
    throw new AppError(400, `Роль має бути однією з: ${ROLE_LIST.join(', ')}`);
  }
}

module.exports = { validateCreateUser };