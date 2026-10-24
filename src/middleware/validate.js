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
  validateIdParam,
  validatePaymentInput,
  validateDateQuery
};