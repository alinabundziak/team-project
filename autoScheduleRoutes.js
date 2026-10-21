const express = require('express');
const router = express.Router();
const autoScheduleController = require('../controllers/autoScheduleController');

router.post('/auto-schedule/generate', autoScheduleController.generateScheduleDraft);
router.post('/auto-schedule/alternatives', autoScheduleController.getAlternativeSlots);
router.get('/auto-schedule/check-balance', autoScheduleController.checkAgeBalance);
router.post('/auto-schedule/confirm', autoScheduleController.confirmSchedule);

module.exports = router;