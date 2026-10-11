const AppError = require('../utils/AppError');

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Потрібна автентифікація'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Недостатньо прав'));
    }
    next();
  };
}

module.exports = authorizeRoles;