const express = require('express');
const controller = require('./users.controller');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorizeRoles = require('../../middleware/authorizeRoles');

const router = express.Router();

router.get('/me', authenticate, asyncHandler(controller.getMe));

router.post('/', authenticate, authorizeRoles('ADMIN'), asyncHandler(controller.create));

// Далі (пункт 5 і 6 плану) тут з'являться GET /, GET/PATCH/DELETE /:id.
// Маршрут '/me' має залишатись ВИЩЕ за '/:id', інакше "me" сприйметься як id.

module.exports = router;