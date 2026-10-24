const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const { parsePagination } = require('../../utils/pagination');
const { parseDateOnly } = require('../../utils/age');
const { validateName, validateIntId } = require('../../utils/validators');

function validateDateFormat(value) {
  if (!parseDateOnly(value)) {
    throw new AppError(400, 'dateOfBirth має бути коректною датою у форматі YYYY-MM-DD');
  }
}

function validateGroupId(value) {
  if (value !== null) validateIntId(value, 'groupId');
}

function validateCreateChild(body) {
  validateName(body.firstName, "Ім'я");
  validateName(body.lastName, 'Прізвище');
  validateDateFormat(body.dateOfBirth);
  if (body.groupId !== undefined) validateGroupId(body.groupId);
}

function validateUpdateChild(body) {
  const fields = ['firstName', 'lastName', 'dateOfBirth', 'groupId'];
  if (!fields.some((f) => body[f] !== undefined)) {
    throw new AppError(400, 'Немає полів для оновлення');
  }
  if (body.firstName !== undefined) validateName(body.firstName, "Ім'я");
  if (body.lastName !== undefined) validateName(body.lastName, 'Прізвище');
  if (body.dateOfBirth !== undefined) validateDateFormat(body.dateOfBirth);
  if (body.groupId !== undefined) validateGroupId(body.groupId);
}

function validateListChildren(query) {
  parsePagination(query);
  if (query.groupId !== undefined) parseId(query.groupId, 'groupId');
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 100)) {
    throw new AppError(400, 'Некоректний параметр search');
  }
}

function validateLinkParent(body) {
  validateIntId(body.parentId, 'parentId');
}

module.exports = { validateCreateChild, validateUpdateChild, validateListChildren, validateLinkParent };