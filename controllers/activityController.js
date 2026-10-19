const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
exports.getAllActivities = async (req, res) => {
  try {
    const activities = await prisma.activities.findMany({
      include: { teacher_activities: { include: { employees: true } } }
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.createActivity = async (req, res) => {
  try {
    const { name } = req.body;
    const activity = await prisma.activities.create({
      data: { name }
    });
    res.status(201).json(activity);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const activity = await prisma.activities.update({
      where: { id: Number(id) },
      data: { name }
    });
    res.json(activity);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.activities.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Заняття успішно видалено' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};