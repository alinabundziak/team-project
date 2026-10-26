function isValidTimeFormat(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

function validateActivity(req, res, next) {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: "Поле 'name' є обов'язковим і має бути непустим рядком" });
  }
  next();
}

function validateScheduleCreate(req, res, next) {
  const { group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time } = req.body;

  if (!group_id || isNaN(Number(group_id))) {
    return res.status(400).json({ error: "Некоректний або відсутній 'group_id'" });
  }
  if (!activity_id || isNaN(Number(activity_id))) {
    return res.status(400).json({ error: "Некоректний або відсутній 'activity_id'" });
  }
  if (!teacher_id || isNaN(Number(teacher_id))) {
    return res.status(400).json({ error: "Некоректний або відсутній 'teacher_id'" });
  }
  if (!room_id || isNaN(Number(room_id))) {
    return res.status(400).json({ error: "Некоректний або відсутній 'room_id'" });
  }
  if (!day_of_week || typeof day_of_week !== 'string') {
    return res.status(400).json({ error: "Некоректний або відсутній 'day_of_week'" });
  }
  if (!isValidTimeFormat(start_time)) {
    return res.status(400).json({ error: "Некоректний формат 'start_time' (очікується HH:MM)" });
  }
  if (!isValidTimeFormat(end_time)) {
    return res.status(400).json({ error: "Некоректний формат 'end_time' (очікується HH:MM)" });
  }

  next();
}

function validateScheduleUpdate(req, res, next) {
  const { start_time, end_time } = req.body;
  if (start_time && !isValidTimeFormat(start_time)) {
    return res.status(400).json({ error: "Некоректний формат 'start_time' (очікується HH:MM)" });
  }
  if (end_time && !isValidTimeFormat(end_time)) {
    return res.status(400).json({ error: "Некоректний формат 'end_time' (очікується HH:MM)" });
  }
  next();
}

module.exports = {
  isValidTimeFormat,
  validateActivity,
  validateScheduleCreate,
  validateScheduleUpdate
};
