function sendOk(res, body) {
  res.status(200).json(body);
}

function sendCreated(res, body) {
  res.status(201).json(body);
}

function sendNoContent(res) {
  res.status(204).send();
}

module.exports = { sendOk, sendCreated, sendNoContent };