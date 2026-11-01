const AppError = require('./AppError');

const NAME_RE = /^\p{L}[\p{L}\s'’ʼ-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_SEPARATORS_RE = /[\s\-().]/g;
const PHONE_RE = /^\+?\d{10,15}$/;

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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateEmail(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, "email є обов'язковим");
  }
  if (value.length > 150 || !EMAIL_RE.test(value.trim())) {
    throw new AppError(400, 'Некоректний email');
  }
}

function validatePassword(value) {
  if (typeof value !== 'string' || !value) {
    throw new AppError(400, "password є обов'язковим");
  }
  if (value.length < 8 || value.length > 72) {
    throw new AppError(400, 'Пароль має містити від 8 до 72 символів');
  }
}

function validateIntId(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new AppError(400, `${label} має бути цілим додатним числом`);
  }
}

function validatePhone(value) {
  if (typeof value !== 'string') {
    throw new AppError(400, "Телефон є обов'язковим");
  }
  const cleaned = value.replace(PHONE_SEPARATORS_RE, '');
  if (!PHONE_RE.test(cleaned)) {
    throw new AppError(400, 'Некоректний телефон (приклад: +380501234567)');
  }
  return cleaned;
}

module.exports = { validateName, isPlainObject, validateEmail, validatePassword, validateIntId, validatePhone };
