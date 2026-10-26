const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { checkScheduleConflicts, generateDraftSchedule } = require('../services/schedule.service');
const { validateActivity, validateScheduleCreate, validateScheduleUpdate } = require('../validators/schedule.validator');

const authModule = require('../middleware/authenticate');


const authenticate = typeof authModule === 'function' ? authModule : authModule.authenticate;
const authorizeRoles = authModule.authorizeRoles || function(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Доступ заборонено: недостатньо прав' });
    }
    next();
  };
};

const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authenticate);


router.get('/activities', asyncHandler(async (req, res) => {
  const list = await prisma.activities.findMany();
  res.json(list);
}));

router.post('/activities', authorizeRoles('Admin', 'Manager'), validateActivity, asyncHandler(async (req, res) => {
  const { name } = req.body;
  const activity = await prisma.activities.create({ data: { name } });
  res.status(201).json(activity);
}));

router.put('/activities/:id', authorizeRoles('Admin', 'Manager'), validateActivity, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;
  const updated = await prisma.activities.update({
    where: { id },
    data: { name }
  });
  res.json(updated);
}));

router.delete('/activities/:id', authorizeRoles('Admin', 'Manager'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.activities.delete({ where: { id } });
  res.status(204).send();
}));


router.get('/schedules', asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;

  if (role === 'Parent') {
    const parentRecord = await prisma.parents.findUnique({
      where: { user_id: userId },
      include: { child_parents: { include: { child: true } } }
    });

    if (!parentRecord) return res.status(404).json({ error: 'Профіль батьків не знайдено' });

    const groupIds = parentRecord.child_parents
      .map(cp => cp.child.group_id)
      .filter(Boolean);

    const schedules = await prisma.schedules.findMany({
      where: { group_id: { in: groupIds } },
      include: { activity: true, room: true, teacher: true }
    });
    return res.json(schedules);
  }

  if (role === 'Teacher') {
    const employee = await prisma.employees.findUnique({ where: { user_id: userId } });
    if (!employee) return res.status(404).json({ error: 'Профіль працівника не знайдено' });

    const schedules = await prisma.schedules.findMany({
      where: { teacher_id: employee.id },
      include: { group: true, activity: true, room: true }
    });
    return res.json(schedules);
  }

  if (role === 'Admin' || role === 'Manager') {
    const allSchedules = await prisma.schedules.findMany({
      include: { group: true, activity: true, teacher: true, room: true }
    });
    return res.json(allSchedules);
  }

  return res.status(403).json({ error: 'Доступ заборонено: недостатньо прав для перегляду розкладу' });
}));

router.post('/schedules', authorizeRoles('Admin', 'Manager', 'Teacher'), validateScheduleCreate, asyncHandler(async (req, res) => {
  const { group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time } = req.body;

  if (req.user.role === 'Teacher') {
    const employee = await prisma.employees.findUnique({ where: { user_id: req.user.id } });
    if (!employee || employee.id !== Number(teacher_id)) {
      return res.status(403).json({ error: 'Викладач може додавати тільки власні заняття' });
    }
  }

  const conflictCheck = await checkScheduleConflicts({
    group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time
  });

  if (!conflictCheck.valid) {
    return res.status(conflictCheck.code).json({ error: conflictCheck.message });
  }

  const newSchedule = await prisma.schedules.create({
    data: {
      group_id: Number(group_id),
      activity_id: Number(activity_id),
      teacher_id: Number(teacher_id),
      room_id: Number(room_id),
      day_of_week: String(day_of_week),
      start_time: new Date(`1970-01-01T${start_time}:00Z`),
      end_time: new Date(`1970-01-01T${end_time}:00Z`)
    }
  });

  res.status(201).json(newSchedule);
}));

router.put('/schedules/:id', authorizeRoles('Admin', 'Manager', 'Teacher'), validateScheduleUpdate, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.schedules.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Запис розкладу не знайдено' });

  let targetTeacherId = req.body.teacher_id ? Number(req.body.teacher_id) : existing.teacher_id;

  if (req.user.role === 'Teacher') {
    const employee = await prisma.employees.findUnique({ where: { user_id: req.user.id } });
    if (!employee || employee.id !== existing.teacher_id) {
      return res.status(403).json({ error: 'Викладач може редагувати тільки власні заняття' });
    }
    // Фіксація teacher_id для викладача
    targetTeacherId = employee.id;
  }

  const updatedData = {
    group_id: req.body.group_id ? Number(req.body.group_id) : existing.group_id,
    activity_id: req.body.activity_id ? Number(req.body.activity_id) : existing.activity_id,
    teacher_id: targetTeacherId,
    room_id: req.body.room_id ? Number(req.body.room_id) : existing.room_id,
    day_of_week: req.body.day_of_week ? String(req.body.day_of_week) : existing.day_of_week,
    start_time: req.body.start_time || `${String(existing.start_time.getUTCHours()).padStart(2, '0')}:${String(existing.start_time.getUTCMinutes()).padStart(2, '0')}`,
    end_time: req.body.end_time || `${String(existing.end_time.getUTCHours()).padStart(2, '0')}:${String(existing.end_time.getUTCMinutes()).padStart(2, '0')}`
  };

  const conflictCheck = await checkScheduleConflicts({
    ...updatedData,
    excludeId: id
  });

  if (!conflictCheck.valid) {
    return res.status(conflictCheck.code).json({ error: conflictCheck.message });
  }

  const updated = await prisma.schedules.update({
    where: { id },
    data: {
      group_id: updatedData.group_id,
      activity_id: updatedData.activity_id,
      teacher_id: updatedData.teacher_id,
      room_id: updatedData.room_id,
      day_of_week: updatedData.day_of_week,
      start_time: new Date(`1970-01-01T${updatedData.start_time}:00Z`),
      end_time: new Date(`1970-01-01T${updatedData.end_time}:00Z`)
    }
  });

  res.json(updated);
}));

router.delete('/schedules/:id', authorizeRoles('Admin', 'Manager', 'Teacher'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.schedules.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Запис розкладу не знайдено' });

  if (req.user.role === 'Teacher') {
    const employee = await prisma.employees.findUnique({ where: { user_id: req.user.id } });
    if (!employee || employee.id !== existing.teacher_id) {
      return res.status(403).json({ error: 'Викладач може видаляти тільки власні заняття' });
    }
  }

  await prisma.schedules.delete({ where: { id } });
  res.status(204).send();
}));

router.post('/schedules/generate-draft', authorizeRoles('Admin', 'Manager'), asyncHandler(async (req, res) => {
  const { day_of_week, items } = req.body;
  if (!day_of_week || !Array.isArray(items)) {
    return res.status(400).json({ error: "Поля 'day_of_week' та 'items' (масив) обов'язкові" });
  }

  const result = await generateDraftSchedule({ day_of_week, items });
  res.status(200).json(result);
}));

module.exports = router;
