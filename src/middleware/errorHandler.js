function errorHandler(err, req, res, next) {
  if (err.status) {
    return res.status(err.status).json({ error: { status: err.status, message: err.message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { status: 400, message: 'Некоректний JSON' } });
  }
  console.error(err);
  res.status(500).json({ error: { status: 500, message: 'Внутрішня помилка сервера' } });
}

module.exports = errorHandler;