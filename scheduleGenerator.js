const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function minutesToDate(mins) {
  const d = new Date(1970, 0, 1);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

const DAY_START = timeToMinutes('09:00');
const DAY_END = timeToMinutes('17:00');

const RESERVED_SLOTS = [
  { name: 'Сніданок', start: timeToMinutes('09:00'), end: timeToMinutes('09:30') },
  { name: 'Обід', start: timeToMinutes('12:00'), end: timeToMinutes('12:30') },
  { name: 'Сон', start: timeToMinutes('13:00'), end: timeToMinutes('14:00') },
  { name: 'Полуденок', start: timeToMinutes('15:30'), end: timeToMinutes('16:00') }
];

function isOverlapping(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function isReservedSlot(start, end) {
  return RESERVED_SLOTS.some(slot => isOverlapping(start, end, slot.start, slot.end));
}

function checkAvailability(existingSchedules, day, start, end, teacherId, groupId, roomId, excludeId = null) {
  for (const item of existingSchedules) {
    if (excludeId && item.id === Number(excludeId)) continue;
    if (item.day_of_week !== day) continue;

    const startDate = new Date(item.start_time);
    const endDate = new Date(item.end_time);
    const itemStart = startDate.getHours() * 60 + startDate.getMinutes();
    const itemEnd = endDate.getHours() * 60 + endDate.getMinutes();

    if (isOverlapping(start, end, itemStart, itemEnd)) {
      if (teacherId && item.teacher_id === Number(teacherId)) return { available: false, reason: `Викладач (ID: ${teacherId}) вже має заняття` };
      if (groupId && item.group_id === Number(groupId)) return { available: false, reason: `Група (ID: ${groupId}) вже має заняття` };
      if (roomId && item.room_id === Number(roomId)) return { available: false, reason: `Кімната (ID: ${roomId}) вже зайнята` };
    }
  }
  return { available: true };
}

function findAlternativeSlots(existingSchedules, day, duration, teacherId, groupId, roomId) {
  const validSlots = [];
  const step = 15;

  for (let current = DAY_START; current + duration <= DAY_END; current += step) {
    const slotEnd = current + duration;

    if (isReservedSlot(current, slotEnd)) continue;

    const check = checkAvailability(existingSchedules, day, current, slotEnd, teacherId, groupId, roomId);
    if (check.available) {
      validSlots.push({
        start_time: minutesToTime(current),
        end_time: minutesToTime(slotEnd)
      });
    }
  }

  return validSlots;
}

async function generateDraftSchedule({ day_of_week, items }) {
  const existingSchedules = await prisma.schedules.findMany();
  const draft = [];
  const errors = [];

  for (const reqItem of items) {
    const { group_id, activity_id, teacher_id, room_id, duration } = reqItem;
    const durationMins = Number(duration) || 45;

    const availableSlots = findAlternativeSlots(
      [...existingSchedules, ...draft],
      Number(day_of_week),
      durationMins,
      teacher_id,
      group_id,
      room_id
    );

    if (availableSlots.length > 0) {
      const chosenSlot = availableSlots[0];
      const newEntry = {
        group_id: Number(group_id),
        activity_id: Number(activity_id),
        teacher_id: Number(teacher_id),
        room_id: Number(room_id),
        day_of_week: Number(day_of_week),
        start_time: minutesToDate(timeToMinutes(chosenSlot.start_time)),
        end_time: minutesToDate(timeToMinutes(chosenSlot.end_time)),
        formatted_start: chosenSlot.start_time,
        formatted_end: chosenSlot.end_time
      };
      draft.push(newEntry);
    } else {
      errors.push({
        item: reqItem,
        reason: 'Неможливо розмістити в межах заданих обмежень'
      });
    }
  }

  return { draft, errors };
}

async function validateAgeBalance() {
  const groups = await prisma.groups.findMany({
    include: { schedules: true }
  });

  const ageMap = {};

  groups.forEach(g => {
    const age = g.target_age;
    const count = g.schedules.length;
    if (!ageMap[age]) ageMap[age] = [];
    ageMap[age].push({ groupId: g.id, groupName: g.name, count });
  });

  const imbalances = [];
  for (const [age, list] of Object.entries(ageMap)) {
    if (list.length > 1) {
      const firstCount = list[0].count;
      const isBalanced = list.every(item => item.count === firstCount);
      if (!isBalanced) {
        imbalances.push({
          target_age: Number(age),
          groups: list
        });
      }
    }
  }

  return { isBalanced: imbalances.length === 0, imbalances };
}

module.exports = {
  generateDraftSchedule,
  findAlternativeSlots,
  validateAgeBalance,
  checkAvailability,
  isReservedSlot,
  isOverlapping,
  timeToMinutes,
  minutesToDate,
  DAY_START,
  DAY_END,
  RESERVED_SLOTS
};
