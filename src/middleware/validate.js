const AppError = require('../utils/AppError');
const parseId = require('../utils/parseId');
const { isPlainObject } = require('../utils/validators');

function validate({ params, query, body } = {}) {
  return (req, res, next) => {
    try {
      if (params) params(req.params);
      if (query) query(req.query);
      if (body) {
        if (!isPlainObject(req.body)) {
          throw new AppError(400, "Тіло запиту має бути JSON-об'єктом");
        }
        body(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function idParams(...names) {
  return (params) => names.forEach((n) => parseId(params[n], n));
}

module.exports = { validate, idParams };