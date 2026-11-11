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

const validateIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (id && isNaN(Number(id))) {
      return res.status(400).json({
        error: `Invalid ID parameter: '${paramName}' must be a valid number`
      });
    }
    next();
  };
};

const validatePaymentInput = (req, res, next) => {
  const { amount, paid_amount } = req.body;

  if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
    return res.status(400).json({
      error: 'Validation Error: amount must be a non-negative number'
    });
  }

  if (paid_amount !== undefined && (typeof paid_amount !== 'number' || paid_amount < 0)) {
    return res.status(400).json({
      error: 'Validation Error: paid_amount must be a non-negative number'
    });
  }

  next();
};

const validateDateQuery = (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (startDate && isNaN(Date.parse(startDate))) {
    return res.status(400).json({
      error: 'Validation Error: Invalid startDate format'
    });
  }

  if (endDate && isNaN(Date.parse(endDate))) {
    return res.status(400).json({
      error: 'Validation Error: Invalid endDate format'
    });
  }

  next();
};

module.exports = {
  validate, 
  idParams,
  validateIdParam,
  validatePaymentInput,
  validateDateQuery
};
