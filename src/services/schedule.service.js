
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const DAY_START = 9 * 60;
const DAY_END = 17 * 60;
const SLOT_STEP = 15;

const RESERVED_SLOTS = [
  { name: 'Сніданок', start: 9 * 60, end: 9 * 60 + 30 },
  { name: 'Обід', start: 12 * 60, end: 12 * 60 + 30 },
  { name: 'Сон', start: 13 * 60, end: 14 * 60 },
  { name: 'Полуденок/Вечеря', start: 15 * 60 + 30, end: 16 * 60 },
];

function isValidTimeFormat(value) {
  return typeof value === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value) {
  if (!isValidTimeFormat(value)) return NaN;

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');

  return `${hours}:${mins}`;
}

function minutesToDate(minutes) {
  return new Date(
    Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60)
  );
}

function dateToMinutes(value) {
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  if (typeof value === 'string') {
    return timeToMinutes(value);
  }

  return NaN;
}

function isOverlapping(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function isReservedSlot(start, end) {
  return RESERVED_SLOTS.some(slot =>
    isOverlapping(start, end, slot.start, slot.end)
  );
}

function isPositiveInteger(value) {
  return (
    (typeof value === 'number' ||
      (typeof value === 'string' && value.trim() !== '')) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

function getScheduleConflicts(item, existingSchedules) {
  const start = dateToMinutes(item.start_time);
  const end = dateToMinutes(item.end_time);

  for (const schedule of existingSchedules) {
    if (Number(schedule.day_of_week) !== Number(item.day_of_week)) {
      continue;
    }

    const existingStart = dateToMinutes(schedule.start_time);
    const existingEnd = dateToMinutes(schedule.end_time);

    if (
      !Number.isFinite(existingStart) ||
      !Number.isFinite(existingEnd) ||
      !isOverlapping(start, end, existingStart, existingEnd)
    ) {
      continue;
    }

    if (Number(schedule.teacher_id) === Number(item.teacher_id)) {
      return 'Викладач уже має заняття у цей час';
    }

    if (Number(schedule.room_id) === Number(item.room_id)) {
      return 'Кімната вже зайнята у цей час';
    }

    if (
      item.sourceGroupId != null &&
      Number(schedule.group_id) === Number(item.sourceGroupId)
    ) {
      return 'Група вже має заняття у цей час';
    }
  }

  return null;
}

function getDraftConflicts(item, draft) {
  const start = dateToMinutes(item.start_time);
  const end = dateToMinutes(item.end_time);

  for (const scheduled of draft) {
    if (
      Number(scheduled.day_of_week) !== Number(item.day_of_week)
    ) {
      continue;
    }

    const scheduledStart = dateToMinutes(scheduled.start_time);
    const scheduledEnd = dateToMinutes(scheduled.end_time);

    if (
      !Number.isFinite(scheduledStart) ||
      !Number.isFinite(scheduledEnd) ||
      !isOverlapping(start, end, scheduledStart, scheduledEnd)
    ) {
      continue;
    }

    const sameScenarioGroup =
      scheduled.scenarioGroupId === item.scenarioGroupId;

    const sameSourceGroup =
      item.sourceGroupId != null &&
      scheduled.sourceGroupId != null &&
      Number(scheduled.sourceGroupId) === Number(item.sourceGroupId);

    if (sameScenarioGroup || sameSourceGroup) {
      return 'Група вже має заняття у цей час';
    }

    if (
      Number(scheduled.teacher_id) === Number(item.teacher_id)
    ) {
      return 'Викладач уже призначений на інше заняття чернетки';
    }

    if (
      Number(scheduled.room_id) === Number(item.room_id)
    ) {
      return 'Кімната вже використовується в іншому занятті чернетки';
    }
  }

  return null;
}

async function verifyTeacherQualification(employeeId, activityId) {
  const record = await prisma.teacher_activities.findUnique({
    where: {
      employee_id_activity_id: {
        employee_id: Number(employeeId),
        activity_id: Number(activityId),
      },
    },
  });

  return Boolean(record);
}

async function checkScheduleConflicts({
  group_id,
  activity_id,
  teacher_id,
  room_id,
  day_of_week,
  start_time,
  end_time,
  excludeId = null,
  additionalSchedules = [],
}) {
  const start = timeToMinutes(start_time);
  const end = timeToMinutes(end_time);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < DAY_START ||
    end > DAY_END ||
    start >= end
  ) {
    return {
      valid: false,
      code: 400,
      message: 'Заняття має бути в межах 09:00–17:00',
    };
  }

  if (isReservedSlot(start, end)) {
    return {
      valid: false,
      code: 400,
      message: 'Час зарезервований для харчування або сну',
    };
  }

  const qualified = await verifyTeacherQualification(
    teacher_id,
    activity_id
  );

  if (!qualified) {
    return {
      valid: false,
      code: 400,
      message: 'Викладач не має відповідної кваліфікації',
    };
  }

  const existing = await prisma.schedules.findMany({
    where: { day_of_week: Number(day_of_week) },
  });

  const allSchedules = [
    ...existing.filter(item => item.id !== Number(excludeId)),
    ...additionalSchedules,
  ];

  const conflict = getScheduleConflicts(
    {
      group_id,
      sourceGroupId: group_id,
      teacher_id,
      room_id,
      day_of_week,
      start_time,
      end_time,
    },
    allSchedules
  );

  if (conflict) {
    return { valid: false, code: 409, message: conflict };
  }

  return { valid: true };
}

function validateAgeBalanceWithDraft(groupsInDb, draft) {
  const counts = {};

  for (const group of groupsInDb) {
    counts[group.id] = group.schedules
      ? group.schedules.length
      : 0;
  }

  for (const item of draft) {
    if (item.group_id != null) {
      counts[item.group_id] = (counts[item.group_id] || 0) + 1;
    }
  }

  const ageMap = {};

  for (const group of groupsInDb) {
    const age = group.target_age;

    if (!ageMap[age]) ageMap[age] = [];

    ageMap[age].push({
      groupId: group.id,
      groupName: group.name,
      count: counts[group.id] || 0,
    });
  }

  const imbalances = [];

  for (const [age, groups] of Object.entries(ageMap)) {
    if (groups.length > 1) {
      const firstCount = groups[0].count;

      if (!groups.every(group => group.count === firstCount)) {
        imbalances.push({
          target_age: Number(age),
          groups,
        });
      }
    }
  }

  return {
    isBalanced: imbalances.length === 0,
    imbalances,
  };
}

/**
 * Generates a temporary schedule for one weekly cycle.
 *
 * Input:
 * {
 *   scenarioId,
 *   variantId,
 *   groups: [{ scenarioGroupId, sourceGroupId?, childrenCount,
 *              capacity, target_age }],
 *   items: [{ scenarioGroupId, activity_id, teacher_id,
 *             room_id, day_of_week, duration }]
 * }
 *
 * Does not create or update database records.
 */
async function generateDraftSchedule({
  scenarioId,
  variantId,
  groups,
  items,
}) {
  if (typeof scenarioId !== 'string' || !scenarioId.trim()) {
    throw new AppError(400, 'scenarioId є обов’язковим');
  }

  if (typeof variantId !== 'string' || !variantId.trim()) {
    throw new AppError(400, 'variantId є обов’язковим');
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    throw new AppError(400, 'Потрібно передати сценарні групи');
  }

  if (!Array.isArray(items)) {
    throw new AppError(400, 'items має бути масивом');
  }

  if (groups.some(group => !group || typeof group !== 'object' || Array.isArray(group))) {
    throw new AppError(400, 'Кожна сценарна група має бути об’єктом');
  }

  if (items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new AppError(400, 'Кожне заняття має бути об’єктом');
  }

  const groupMap = new Map();

  for (const group of groups) {
    if (
      typeof group.scenarioGroupId !== 'string' ||
      !group.scenarioGroupId.trim() ||
      groupMap.has(group.scenarioGroupId)
    ) {
      throw new AppError(400, 'Некоректний або повторний scenarioGroupId');
    }

    if (
      !isPositiveInteger(group.childrenCount) ||
      !isPositiveInteger(group.capacity) ||
      Number(group.childrenCount) > Number(group.capacity)
    ) {
      throw new AppError(
        400,
        `Некоректна кількість дітей або місткість групи ${group.scenarioGroupId}`
      );
    }

    if (
      group.sourceGroupId != null &&
      !isPositiveInteger(group.sourceGroupId)
    ) {
      throw new AppError(400, 'sourceGroupId має бути додатним цілим числом');
    }

    groupMap.set(group.scenarioGroupId, group);
  }

  const days = [...new Set(
    items.map(item => Number(item.day_of_week))
  )];

  for (const day of days) {
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw new AppError(400, 'day_of_week має бути цілим числом від 1 до 7');
    }
  }

  const sourceGroupIds = [
    ...new Set(
      groups
        .filter(group => group.sourceGroupId != null)
        .map(group => Number(group.sourceGroupId))
    ),
  ];

  const roomIds = [
    ...new Set(
      items
        .map(item => Number(item.room_id))
        .filter(id => Number.isInteger(id) && id > 0)
    ),
  ];


  const [sourceGroups, rooms, existingSchedules] = await Promise.all([
    sourceGroupIds.length
      ? prisma.groups.findMany({
          where: { id: { in: sourceGroupIds } },
          select: { id: true },
        })
      : Promise.resolve([]),

    roomIds.length
      ? prisma.rooms.findMany({
          where: { id: { in: roomIds } },
          select: { id: true },
        })
      : Promise.resolve([]),

    days.length
      ? prisma.schedules.findMany({
          where: { day_of_week: { in: days } },
        })
      : Promise.resolve([]),
  ]);

  const existingGroupIds = new Set(sourceGroups.map(group => group.id));
  const existingRoomIds = new Set(rooms.map(room => room.id));

  const draft = [];
  const errors = [];

  const sortedItems = [...items].sort((a, b) =>
    Number(a.day_of_week) - Number(b.day_of_week)
  );

  for (let index = 0; index < sortedItems.length; index++) {
    const item = sortedItems[index];

    const fail = reason => {
      errors.push({
        itemIndex: index,
        item,
        reason,
      });
    };

    const group = groupMap.get(item.scenarioGroupId);

    if (!group) {
      throw new AppError(
        400,
        `Заняття ${index + 1} посилається на невідому сценарну групу`
      );
    }

    const {
      activity_id,
      teacher_id,
      room_id,
      day_of_week,
      duration,
    } = item;

    if (
      !Number.isInteger(Number(day_of_week)) ||
      Number(day_of_week) < 1 ||
      Number(day_of_week) > 7
    ) {
      fail('День тижня має бути цілим числом від 1 до 7');
      continue;
    }

    if (!isPositiveInteger(duration)) {
      fail('Тривалість має бути додатним цілим числом у хвилинах');
      continue;
    }

    if (Number(duration) > DAY_END - DAY_START) {
      fail('Тривалість заняття перевищує робочий день 09:00–17:00');
      continue;
    }
    if (
      !isPositiveInteger(activity_id) ||
      !isPositiveInteger(teacher_id) ||
      !isPositiveInteger(room_id)
    ) {
      fail('ID предмета, викладача та кімнати мають бути додатними цілими числами');
      continue;
    }

    if (!existingRoomIds.has(Number(room_id))) {
      fail('Вказана кімната не існує');
      continue;
    }

    if (
      group.sourceGroupId != null &&
      !existingGroupIds.has(Number(group.sourceGroupId))
    ) {
      fail('Початкова група не існує');
      continue;
    }

    const qualified = await verifyTeacherQualification(
      teacher_id,
      activity_id
    );

    if (!qualified) {
      fail('Викладач не має кваліфікації для цього заняття');
      continue;
    }

    const sourceGroupId = group.sourceGroupId == null
      ? null
      : Number(group.sourceGroupId);

    let foundSlot = null;

    for (
      let start = DAY_START;
      start + Number(duration) <= DAY_END;
      start += SLOT_STEP
    ) {
      const end = start + Number(duration);

      if (isReservedSlot(start, end)) continue;

      const candidate = {
        scenarioId,
        variantId,
        scenarioGroupId: item.scenarioGroupId,
        sourceGroupId,
        activity_id: Number(activity_id),
        teacher_id: Number(teacher_id),
        room_id: Number(room_id),
        day_of_week: Number(day_of_week),
        start_time: minutesToDate(start),
        end_time: minutesToDate(end),
        formatted_start: minutesToTime(start),
        formatted_end: minutesToTime(end),
      };

      const dbConflict = getScheduleConflicts(
        candidate,
        existingSchedules
      );

      if (dbConflict) continue;

      const draftConflict = getDraftConflicts(candidate, draft);

      if (draftConflict) continue;

      foundSlot = candidate;
      break;
    }

    if (foundSlot) {
      draft.push(foundSlot);
    } else {
      fail(
        'Не вдалося знайти вільний час без конфліктів у межах 09:00–17:00'
      );
    }
  }

  return {
    scenarioId,
    variantId,

    groupComposition: groups.map(group => ({
      scenarioGroupId: group.scenarioGroupId,
      sourceGroupId: group.sourceGroupId ?? null,
      childrenCount: Number(group.childrenCount),
      capacity: Number(group.capacity),
      target_age: group.target_age ?? null,
    })),

    isFeasible: errors.length === 0,

    summary: {
      totalItems: items.length,
      scheduledItems: draft.length,
      unscheduledItems: errors.length,
    },

    draft,
    errors,

    // Підтверджуємо, що це лише тимчасовий результат.
    persisted: false,
  };
}

module.exports = {
  checkScheduleConflicts,
  generateDraftSchedule,
  verifyTeacherQualification,
  validateAgeBalanceWithDraft,
  isValidTimeFormat,
  timeToMinutes,
  minutesToDate,
  isReservedSlot,
  isOverlapping,
};
