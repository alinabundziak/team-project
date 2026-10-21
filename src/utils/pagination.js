const AppError = require('./AppError');
const parseId = require('./parseId');

function parseQueryInt(value, defaultValue, name, max) {
  if (value === undefined) return defaultValue;
  const n = parseId(value, name);
  if (n > max) throw new AppError(400, `${name} не може бути більше ${max}`);
  return n;
}

function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  return {
    page: parseQueryInt(query.page, 1, 'page', 100000),
    limit: parseQueryInt(query.limit, defaultLimit, 'limit', maxLimit),
  };
}

module.exports = { parsePagination };