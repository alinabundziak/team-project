const AppError = require('./AppError');

const NAME_RE = /^\p{L}[\p{L}\s'’ʼ-]*$/u;

function validateName(value, label, maxLength = 100) {
  if (typeof value !== 'string') {
    throw new AppError(400, `${label} є обов'язковим`);
  }
  const v = value.trim();
  if (!v || v.length > maxLength || !NAME_RE.test(v)) {
    throw new AppError(400, `Некоректне поле: ${label}`);
  }
  return v;
}

module.exports = { validateName };