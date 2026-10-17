const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkScheduleConflicts({ day_of_week, start_time, end_time, room_id, teacher_id, group_id, excludeId = null }) {
  const startTimeObj = new Date(start_time);
  const endTimeObj = new Date(end_time);

  const whereClause = {
    day_of_week: Number(day_of_week),
    ...(excludeId && { id: { not: Number(excludeId) } }),
    AND: [
      { start_time: { lt: endTimeObj } },
      { end_time: { gt: startTimeObj } }
    ],
    OR: [
      ...(room_id ? [{ room_id: Number(room_id) }] : []),
      ...(teacher_id ? [{ teacher_id: Number(teacher_id) }] : []),
      ...(group_id ? [{ group_id: Number(group_id) }] : [])
    ]
  };

  const conflictingEntry = await prisma.schedules.findFirst({
    where: whereClause,
    include: { rooms: true, employees: true, groups: true }
  });

  if (conflictingEntry) {
    if (room_id && conflictingEntry.room_id === Number(room_id)) {
      return `Кімната "${conflictingEntry.rooms?.name || room_id}" вже зайнята в цей час.`;
    }
    if (teacher_id && conflictingEntry.teacher_id === Number(teacher_id)) {
      return `Викладач (${conflictingEntry.employees?.first_name} ${conflictingEntry.employees?.last_name}) вже має заняття в цей час.`;
    }
    if (group_id && conflictingEntry.group_id === Number(group_id)) {
      return `Група "${conflictingEntry.groups?.name || group_id}" вже має заняття в цей час.`;
    }
  }

  return null; 
}
exports.createScheduleEntry = async (req, res) => {
  try {
    const { group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time } = req.body;

    const conflictError = await checkScheduleConflicts({
      day_of_week,
      start_time,
      end_time,
      room_id,
      teacher_id,
      group_id
    });

    if (conflictError) {
      return res.status(409).json({ error: conflictError });
    }
    const schedule = await prisma.schedules.create({
      data: {
        group_id: group_id ? Number(group_id) : null,
        activity_id: activity_id ? Number(activity_id) : null,
        teacher_id: teacher_id ? Number(teacher_id) : null,
        room_id: room_id ? Number(room_id) : null,
        day_of_week: Number(day_of_week),
        start_time: new Date(start_time),
        end_time: new Date(end_time)
      }
    });

    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.getAllSchedules = async (req, res) => {
  try {
    const schedules = await prisma.schedules.findMany({
      include: {
        activities: true,
        groups: true,
        rooms: true,
        employees: true
      }
    });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.updateScheduleEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { group_id, activity_id, teacher_id, room_id, day_of_week, start_time, end_time } = req.body;

    const conflictError = await checkScheduleConflicts({
      day_of_week,
      start_time,
      end_time,
      room_id,
      teacher_id,
      group_id,
      excludeId: id
    });

    if (conflictError) {
      return res.status(409).json({ error: conflictError });
    }

    const schedule = await prisma.schedules.update({
      where: { id: Number(id) },
      data: {
        group_id: group_id ? Number(group_id) : null,
        activity_id: activity_id ? Number(activity_id) : null,
        teacher_id: teacher_id ? Number(teacher_id) : null,
        room_id: room_id ? Number(room_id) : null,
        day_of_week: Number(day_of_week),
        start_time: new Date(start_time),
        end_time: new Date(end_time)
      }
    });

    res.json(schedule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.deleteScheduleEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.schedules.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Запис розкладу видалено' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};