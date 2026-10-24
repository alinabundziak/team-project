const AppError = require('../../utils/AppError');

function validateLogin(body) {
  if (
    typeof body.email !== 'string' || !body.email.trim() ||
    typeof body.password !== 'string' || !body.password
  ) {
    throw new AppError(400, 'Потрібні email та пароль');
  }
}

module.exports = { validateLogin };