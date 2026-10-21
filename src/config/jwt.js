const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET не задано в .env');
}

module.exports = {
  secret,
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  algorithm: 'HS256',
};