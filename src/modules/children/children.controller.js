const service = require("./children.service");

function getChildren(req, res) {
    const children = service.getChildren();
    res.json(children);
}

module.exports = { getChildren };