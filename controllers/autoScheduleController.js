const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const scheduleGen = require('../services/scheduleGenerator');

exports.generateScheduleDraft = async (req, res) => {
  try {
    const { day_of_week, items } = req.body;

    if (!day_of_week || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Потрібно вказати day_of_week та масив items' });
    }

    const result = await scheduleGen.generateDraftSchedule({ day_of_week, items });
    res.json({
      message: 'Попередній розклад успішно згенеровано',
      draft: result.draft,
      unassigned: result.errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAlternativeSlots = async (req, res) => {
  try {
    const { day_of_week, duration, teacher_id, group_id, room_id } = req.body;
    const existingSchedules = await prisma.schedules.findMany();

    const slots = scheduleGen.findAlternativeSlots(
      existingSchedules,
      Number(day_of_week),
      Number(duration) || 45,
      teacher_id,
      group_id,
      room_id
    );

    res.json({ day_of_week, available_slots: slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkAgeBalance = async (req, res) => {
  try {
    const balance = await scheduleGen.validateAgeBalance();
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.confirmSchedule = async (req, res) => {
  try {
    const { draft } = req.body;

    if (!Array.isArray(draft) || draft.length === 0) {
      return res.status(400).json({ error: 'Порожній черновий розклад' });
    }

    const createdEntries = await prisma.schedules.createMany({
      data: draft.map(item => ({
        group_id: item.group_id,
        activity_id: item.activity_id,
        teacher_id: item.teacher_id,
        room_id: item.room_id,
        day_of_week: item.day_of_week,
        start_time: new Date(item.start_time),
        end_time: new Date(item.end_time)
      }))
    });

    res.status(201).json({
      message: 'Розклад успішно підтверджено та збережено в базу даних',
      count: createdEntries.count
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};