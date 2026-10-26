const jwt = require('jsonwebtoken');
const repo = require('../modules/users/users.repository');
const AppError = require('../utils/AppError');
const { secret, algorithm } = require('../config/jwt');

async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'Потрібна автентифікація');
    }

    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: [algorithm] });
    } catch {
      throw new AppError(401, 'Недійсний або прострочений токен');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      throw new AppError(401, 'Недійсний токен');
    }

    const user = await repo.findById(userId);
    if (!user || !user.roles) {
      throw new AppError(401, 'Користувача не знайдено');
    }

    req.user = { id: user.id, email: user.email, role: user.roles.name };
    next();
  } catch (err) {
    next(err);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Доступ заборонено: недостатньо прав'));
    }
    next();
  };
}


module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.authorizeRoles = authorizeRoles;
