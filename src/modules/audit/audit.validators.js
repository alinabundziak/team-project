
const AppError = require('../../utils/AppError');
const { parsePagination } = require('../../utils/pagination');

const ALLOWED_OPERATIONS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
];

const MAX_TABLE_NAME_LENGTH = 128;

function validateDate(value, name) {
  if (value === undefined) return;

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new AppError(
      400,
      `${name} має бути у форматі YYYY-MM-DD`
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, `Некоректна дата ${name}`);
  }
}

function validateListAudit(query) {
  const { tableName, operation, from, to } = query;

  if (
    tableName !== undefined &&
    (
      typeof tableName !== 'string' ||
      tableName.trim().length === 0 ||
      tableName.length > MAX_TABLE_NAME_LENGTH
    )
  ) {
    throw new AppError(400, 'Некоректний tableName');
  }

  if (
    operation !== undefined &&
    !ALLOWED_OPERATIONS.includes(operation)
  ) {
    throw new AppError(400, 'Некоректний operation');
  }

  validateDate(from, 'from');
  validateDate(to, 'to');

  if (
    from !== undefined &&
    to !== undefined &&
    from > to
  ) {
    throw new AppError(
      400,
      'Дата from не може бути пізніше за to'
    );
  }

  parsePagination(query);
}

module.exports = { validateListAudit };
