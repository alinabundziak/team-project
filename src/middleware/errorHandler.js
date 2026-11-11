function notFound(req, res) {
  res.status(404).json({ error: { status: 404, message: 'Маршрут не знайдено' } });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status;
  let message = err.message;
  
  switch (true) {
    case err.type === 'entity.parse.failed':
      status = 400;
      message = 'Некоректний JSON';
      break;
    case err.type === 'entity.too.large':
      status = 413;
      message = 'Запит занадто великий';
      break;
    case err.code === 'P2002':
      status = 409;
      message = 'Запис з такими даними вже існує';
      break;
    case err.code === 'P2025':
      status = 404;
      message = 'Запис не знайдено';
      break;
    case err.code === 'P2003':
      status = 409;
      message = "Порушено зв'язок з іншими даними";
      break;
  }

  if (!status) {
    console.error(err);
    status = 500;
    message = 'Внутрішня помилка сервера';
  }

  res.status(status).json({ error: { status, message } });
}

module.exports = errorHandler;
module.exports.notFound = notFound;