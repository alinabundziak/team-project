const AppError = require('../../utils/AppError');
const { parsePagination } = require('../../utils/pagination');
const { validateName, validateIntId, validatePhone } = require('../../utils/validators');

function validateSearch(query) {
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 100)) {
    throw new AppError(400, 'Некоректний параметр search');
  }
}

function validateCreateParent(body) {
  validateIntId(body.userId, 'userId');
  validateName(body.firstName, "Ім'я");
  validateName(body.lastName, 'Прізвище');
  validatePhone(body.phone);
}

function validateUpdateParent(body) {
  if (body.userId !== undefined) {
    throw new AppError(400, 'userId змінювати не можна');
  }
  const fields = ['firstName', 'lastName', 'phone'];
  if (!fields.some((f) => body[f] !== undefined)) {
    throw new AppError(400, 'Немає полів для оновлення');
  }
  if (body.firstName !== undefined) validateName(body.firstName, "Ім'я");
  if (body.lastName !== undefined) validateName(body.lastName, 'Прізвище');
  if (body.phone !== undefined) validatePhone(body.phone);
}

function validateListParents(query) {
  parsePagination(query);
  validateSearch(query);
}

function validatePageQuery(query) {
  parsePagination(query);
}

module.exports = { validateCreateParent, validateUpdateParent, validateListParents, validatePageQuery };