function isPositiveInteger(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0;
}

function isValidDayOfWeek(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }

  const day = Number(value);

  return Number.isInteger(day) && day >= 1 && day <= 7;
}

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

  if (!isPositiveInteger(group_id)) return res.status(400).json({ error: "group_id має бути додатним цілим числом" });
  if (!isPositiveInteger(activity_id)) return res.status(400).json({ error: "activity_id має бути додатним цілим числом" });
  if (!isPositiveInteger(teacher_id)) return res.status(400).json({ error: "teacher_id має бути додатним цілим числом" });
  if (!isPositiveInteger(room_id)) return res.status(400).json({ error: "room_id має бути додатним цілим числом" });

  if (!isValidDayOfWeek(day_of_week)) {
  return res.status(400).json({
    error: "day_of_week має бути цілим числом від 1 до 7"
  });
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
  const { group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time } = req.body;

  if (group_id !== undefined && !isPositiveInteger(group_id)) return res.status(400).json({ error: "group_id має бути додатним цілим числом" });
  if (activity_id !== undefined && !isPositiveInteger(activity_id)) return res.status(400).json({ error: "activity_id має бути додатним цілим числом" });
  if (teacher_id !== undefined && !isPositiveInteger(teacher_id)) return res.status(400).json({ error: "teacher_id має бути додатним цілим числом" });
  if (room_id !== undefined && !isPositiveInteger(room_id)) return res.status(400).json({ error: "room_id має бути додатним цілим числом" });
  if (day_of_week !== undefined && !isValidDayOfWeek(day_of_week)) {
  return res.status(400).json({
    error: "day_of_week має бути цілим числом від 1 до 7"
  });
}

  if (start_time && !isValidTimeFormat(start_time)) {
    return res.status(400).json({ error: "Некоректний формат 'start_time' (очікується HH:MM)" });
  }
  if (end_time && !isValidTimeFormat(end_time)) {
    return res.status(400).json({ error: "Некоректний формат 'end_time' (очікується HH:MM)" });
  }

  next();
}

module.exports = {
  isPositiveInteger,
  isValidDayOfWeek,
  isValidTimeFormat,
  validateActivity,
  validateScheduleCreate,
  validateScheduleUpdate
};
