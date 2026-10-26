const service = require('./payments.service');

async function create(req, res, next) {
  try {
    const result = await service.createPayment(req.params.childId, req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { create };