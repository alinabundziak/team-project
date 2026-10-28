const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');
const { ROLES } = require('../../config/roles');

const router = express.Router();

router.get('/whoami', authenticate, (req, res) => {
  const { id, email, role } = req.user;
  res.json({ userId: id, email, role });
});

router.get('/admin-only', authenticate, authorizeRoles(ROLES.ADMIN), (req, res) => {
  res.json({ message: 'Доступ тільки для ADMIN', userId: req.user.id });
});

router.get(
  '/staff-only',
  authenticate,
  authorizeRoles(ROLES.ADMIN, ROLES.MANAGER),
  (req, res) => {
    res.json({ message: 'Доступ для ADMIN та MANAGER', role: req.user.role });
  }
);

module.exports = router;