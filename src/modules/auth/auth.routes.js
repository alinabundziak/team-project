const express = require('express');
const controller = require('./auth.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');

const router = express.Router();

router.post('/login', asyncHandler(controller.login));

router.get('/test/any', authenticate, (req, res) => res.json({ user: req.user }));
router.get('/test/admin', authenticate, authorizeRoles('ADMIN'), (req, res) =>
  res.json({ message: 'Привіт, адмін', user: req.user })
);

module.exports = router;