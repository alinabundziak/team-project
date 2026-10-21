const AppError = require('./AppError');

function parseId(value, name = 'id') {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(400, `${name} має бути цілим додатним числом`);
  }
  const n = Number(value);
  if (n < 1 || n > 2147483647) {
    throw new AppError(400, `${name} має бути цілим додатним числом`);
  }
  return n;
}

module.exports = parseId;