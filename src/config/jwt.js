const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET не задано в .env');
}

if (secret.length < 32) {
  const msg = 'JWT_SECRET занадто короткий (потрібно щонайменше 32 символи)';
  if (process.env.NODE_ENV === 'production') throw new Error(msg);
  console.warn(`УВАГА: ${msg}`);
}

module.exports = {
  secret,
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  algorithm: 'HS256',
};