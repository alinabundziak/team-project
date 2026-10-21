const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const scheduleGen = require('../services/scheduleGenerator');

function validateScheduleItem(item) {
  const { group_id, activity_id, teacher_id, room_id, duration } = item;
  if (!Number.isInteger(Number(group_id)) || Number(group_id) <= 0) return 'group_id має бути додатним цілим числом';
  if (!Number.isInteger(Number(activity_id)) || Number(activity_id) <= 0) return 'activity_id має бути додатним цілим числом';
  if (!Number.isInteger(Number(teacher_id)) || Number(teacher_id) <= 0) return 'teacher_id має бути додатним цілим числом';
  if (!Number.isInteger(Number(room_id)) || Number(room_id) <= 0) return 'room_id має бути додатним цілим числом';
  if (duration !== undefined && (isNaN(Number(duration)) || Number(duration) <= 0)) return 'duration має бути додатним числом';
  return null;
}

exports.generateScheduleDraft = async (req, res) => {
  try {
    const { day_of_week, items } = req.body;

    const day = Number(day_of_week);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      return res.status(400).json({ error: 'day_of_week має бути цілим числом від 1 (Понеділок) до 7 (Неділя)' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Масив items не може бути порожнім' });
    }

    for (const item of items) {
      const err = validateScheduleItem(item);
      if (err) return res.status(400).json({ error: `Помилка у елементі items: ${err}` });
    }

    const result = await scheduleGen.generateDraftSchedule({ day_of_week: day, items });
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

    const day = Number(day_of_week);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      return res.status(400).json({ error: 'day_of_week має бути цілим числом від 1 до 7' });
    }

    const dur = Number(duration);
    if (isNaN(dur) || dur <= 0) {
      return res.status(400).json({ error: 'duration має бути додатним числом' });
    }

    const err = validateScheduleItem({ group_id, activity_id: 1, teacher_id, room_id, duration: dur });
    if (err) return res.status(400).json({ error: err });

    const existingSchedules = await prisma.schedules.findMany();
    const slots = scheduleGen.findAlternativeSlots(
      existingSchedules,
      day,
      dur,
      teacher_id,
      group_id,
      room_id
    );

    res.json({ day_of_week: day, available_slots: slots });
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

    const existingSchedules = await prisma.schedules.findMany();
    const validatedDraft = [];

    for (let i = 0; i < draft.length; i++) {
      const item = draft[i];

      const startDate = new Date(item.start_time);
      const endDate = new Date(item.end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: `Некоректний формат часу в елементі #${i + 1}` });
      }

      const startMins = startDate.getHours() * 60 + startDate.getMinutes();
      const endMins = endDate.getHours() * 60 + endDate.getMinutes();

      if (startMins >= endMins) {
        return res.status(400).json({ error: `Час початку має бути меншим за час завершення в елементі #${i + 1}` });
      }

      if (scheduleGen.isReservedSlot(startMins, endMins)) {
        return res.status(409).json({ error: `Конфлікт обмежень: Елемент #${i + 1} припадає на час сну або харчування` });
      }

      const dbCheck = scheduleGen.checkAvailability(
        existingSchedules,
        Number(item.day_of_week),
        startMins,
        endMins,
        item.teacher_id,
        item.group_id,
        item.room_id
      );

      if (!dbCheck.available) {
        return res.status(409).json({ error: `Конфлікт із БД в елементі #${i + 1}: ${dbCheck.reason}` });
      }

      const draftCheck = scheduleGen.checkAvailability(
        validatedDraft,
        Number(item.day_of_week),
        startMins,
        endMins,
        item.teacher_id,
        item.group_id,
        item.room_id
      );

      if (!draftCheck.available) {
        return res.status(409).json({ error: `Внутрішній конфлікт у драфті між елементами: ${draftCheck.reason}` });
      }

      validatedDraft.push({
        group_id: Number(item.group_id),
        activity_id: Number(item.activity_id),
        teacher_id: Number(item.teacher_id),
        room_id: Number(item.room_id),
        day_of_week: Number(item.day_of_week),
        start_time: startDate,
        end_time: endDate
      });
    }

    const createdEntries = await prisma.schedules.createMany({
      data: validatedDraft
    });

    res.status(201).json({
      message: 'Розклад успішно підтверджено та збережено в базу даних',
      count: createdEntries.count
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
