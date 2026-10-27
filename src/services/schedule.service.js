const prisma = require('../config/prisma');

function isValidTimeFormat(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

function timeToMinutes(timeStr) {
  if (!isValidTimeFormat(timeStr)) return NaN;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function minutesToDate(mins) {
  return new Date(Date.UTC(1970, 0, 1, Math.floor(mins / 60), mins % 60, 0, 0));
}

const DAY_START = timeToMinutes('09:00');
const DAY_END = timeToMinutes('17:00');

const RESERVED_SLOTS = [
  { name: 'Сніданок', start: timeToMinutes('09:00'), end: timeToMinutes('09:30') },
  { name: 'Обід', start: timeToMinutes('12:00'), end: timeToMinutes('12:30') },
  { name: 'Сон', start: timeToMinutes('13:00'), end: timeToMinutes('14:00') },
  { name: 'Полуденок/Вечеря', start: timeToMinutes('15:30'), end: timeToMinutes('16:00') }
];

function isOverlapping(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function isReservedSlot(start, end) {
  return RESERVED_SLOTS.some(slot => isOverlapping(start, end, slot.start, slot.end));
}

async function verifyTeacherQualification(employeeId, activityId) {
  const record = await prisma.teacher_activities.findUnique({
    where: {
      employee_id_activity_id: {
        employee_id: Number(employeeId),
        activity_id: Number(activityId)
      }
    }
  });
  return !!record;
}

async function checkScheduleConflicts({ group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time, excludeId = null, additionalSchedules = [] }) {
  const startMins = timeToMinutes(start_time);
  const endMins = timeToMinutes(end_time);

  if (isNaN(startMins) || isNaN(endMins) || startMins < DAY_START || endMins > DAY_END || startMins >= endMins) {
    return { valid: false, code: 400, message: 'Заняття виходить за межі робочого дня (09:00 - 17:00) або вказано некоректний час' };
  }

  if (isReservedSlot(startMins, endMins)) {
    return { valid: false, code: 400, message: 'Час збігається з тихим часом (соном) або харчуванням' };
  }

  const qualified = await verifyTeacherQualification(teacher_id, activity_id);
  if (!qualified) {
    return { valid: false, code: 400, message: 'Викладач не має кваліфікації/права проводити цей предмет' };
  }

  const existingInDb = await prisma.schedules.findMany({
    where: { day_of_week: String(day_of_week) }
  });

  const allSchedules = [...existingInDb, ...additionalSchedules.filter(s => String(s.day_of_week) === String(day_of_week))];

  for (const item of allSchedules) {
    if (excludeId && item.id && item.id === Number(excludeId)) continue;

    let itemStart, itemEnd;

    if (item.start_time instanceof Date) {
      itemStart = item.start_time.getUTCHours() * 60 + item.start_time.getUTCMinutes();
      itemEnd = item.end_time.getUTCHours() * 60 + item.end_time.getUTCMinutes();
    } else if (typeof item.start_time === 'string' && typeof item.end_time === 'string') {
      itemStart = timeToMinutes(item.start_time);
      itemEnd = timeToMinutes(item.end_time);
    } else {
      continue;
    }

    if (isOverlapping(startMins, endMins, itemStart, itemEnd)) {
      if (item.teacher_id === Number(teacher_id)) {
        return { valid: false, code: 409, message: `Конфлікт: Викладач (ID: ${teacher_id}) вже має заняття у цей час` };
      }
      if (item.group_id === Number(group_id)) {
        return { valid: false, code: 409, message: `Конфлікт: Група (ID: ${group_id}) вже має інше заняття у цей час` };
      }
      if (item.room_id === Number(room_id)) {
        return { valid: false, code: 409, message: `Конфлікт: Кімната (ID: ${room_id}) вже зайнята` };
      }
    }
  }

  return { valid: true };
}

function validateAgeBalanceWithDraft(groupsInDb, draft) {
  const groupSchedulesCount = {};
  groupsInDb.forEach(g => {
    groupSchedulesCount[g.id] = g.schedules ? g.schedules.length : 0;
  });

  draft.forEach(item => {
    const gId = item.group_id;
    groupSchedulesCount[gId] = (groupSchedulesCount[gId] || 0) + 1;
  });

  const ageMap = {};
  groupsInDb.forEach(g => {
    const age = g.target_age;
    const count = groupSchedulesCount[g.id] || 0;
    if (!ageMap[age]) ageMap[age] = [];
    ageMap[age].push({ groupId: g.id, groupName: g.name, count });
  });

  const imbalances = [];
  for (const [age, list] of Object.entries(ageMap)) {
    if (list.length > 1) {
      const firstCount = list[0].count;
      const isBalanced = list.every(item => item.count === firstCount);
      if (!isBalanced) {
        imbalances.push({ target_age: Number(age), groups: list });
      }
    }
  }

  return { isBalanced: imbalances.length === 0, imbalances };
}

async function generateDraftSchedule({ day_of_week, items }) {
  const draft = [];
  const errors = [];
  const dayStr = String(day_of_week);

  const groupsInDb = await prisma.groups.findMany({
    include: { schedules: true }
  });

  const ageGroupCounts = {};
  const groupTargetAges = {};

  groupsInDb.forEach(g => {
    groupTargetAges[g.id] = g.target_age;
    if (!ageGroupCounts[g.target_age]) ageGroupCounts[g.target_age] = {};
    ageGroupCounts[g.target_age][g.id] = g.schedules ? g.schedules.length : 0;
  });

  const sortedItems = [...items].sort((a, b) => {
    const ageA = groupTargetAges[a.group_id] || 0;
    const ageB = groupTargetAges[b.group_id] || 0;
    const countA = (ageGroupCounts[ageA] && ageGroupCounts[ageA][a.group_id]) || 0;
    const countB = (ageGroupCounts[ageB] && ageGroupCounts[ageB][b.group_id]) || 0;
    return countA - countB;
  });

  for (const reqItem of sortedItems) {
    const { group_id, activity_id, teacher_id, room_id, duration } = reqItem;

    // ВАЛІДАЦІЯ DURATION:
    const durationMins = Number(duration);
    if (!Number.isInteger(durationMins) || durationMins <= 0) {
      errors.push({ item: reqItem, reason: 'Тривалість заняття (duration) має бути додатним цілим числом у хвилинах' });
      continue;
    }

    const targetAge = groupTargetAges[group_id];
    if (targetAge && ageGroupCounts[targetAge]) {
      const currentCount = ageGroupCounts[targetAge][group_id] || 0;
      const otherGroupCounts = Object.entries(ageGroupCounts[targetAge])
        .filter(([gId]) => Number(gId) !== Number(group_id))
        .map(([, cnt]) => cnt);

      if (otherGroupCounts.length > 0) {
        const minOtherCount = Math.min(...otherGroupCounts);
        if (currentCount > minOtherCount) {
          errors.push({ item: reqItem, reason: 'Пропущено для забезпечення рівномірності занять серед груп одного віку' });
          continue;
        }
      }
    }

    const qualified = await verifyTeacherQualification(teacher_id, activity_id);
    if (!qualified) {
      errors.push({ item: reqItem, reason: 'Викладач не має відповідної кваліфікації/активності' });
      continue;
    }

    let foundSlot = null;
    for (let current = DAY_START; current + durationMins <= DAY_END; current += 15) {
      const slotEnd = current + durationMins;
      if (isReservedSlot(current, slotEnd)) continue;

      const check = await checkScheduleConflicts({
        group_id, activity_id, teacher_id, room_id,
        day_of_week: dayStr,
        start_time: minutesToTime(current),
        end_time: minutesToTime(slotEnd),
        additionalSchedules: draft
      });

      if (check.valid) {
        foundSlot = { start: minutesToTime(current), end: minutesToTime(slotEnd) };
        break;
      }
    }

    if (foundSlot) {
      draft.push({
        group_id: Number(group_id),
        activity_id: Number(activity_id),
        teacher_id: Number(teacher_id),
        room_id: Number(room_id),
        day_of_week: dayStr,
        start_time: minutesToDate(timeToMinutes(foundSlot.start)),
        end_time: minutesToDate(timeToMinutes(foundSlot.end)),
        formatted_start: foundSlot.start,
        formatted_end: foundSlot.end
      });

      if (targetAge && ageGroupCounts[targetAge]) {
        ageGroupCounts[targetAge][group_id] = (ageGroupCounts[targetAge][group_id] || 0) + 1;
      }
    } else {
      errors.push({ item: reqItem, reason: 'Неможливо розмістити без конфліктів у робочі години' });
    }
  }

  const balanceCheck = validateAgeBalanceWithDraft(groupsInDb, draft);

  return { draft, errors, balanceCheck };
}

module.exports = {
  checkScheduleConflicts,
  generateDraftSchedule,
  verifyTeacherQualification,
  validateAgeBalanceWithDraft,
  isValidTimeFormat,
  timeToMinutes,
  minutesToDate
};
