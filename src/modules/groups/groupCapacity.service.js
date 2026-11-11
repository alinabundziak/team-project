const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");

const MAX_CHILDREN_PER_GROUP = 20;

async function assertGroupHasCapacity(groupId, excludeChildId) {
    const group = await prisma.groups.findUnique({
        where: { id: groupId },
        select: {
            id: true,
            capacity: true,
            room: {
                select: {
                    capacity: true
                }
            }
        }
    });

    if (!group) {
        throw new AppError(404, "Групу не знайдено");
    }

    if (!group.room) {
        throw new AppError(409, "Для групи не призначено базове приміщення");
    }

    const maxCapacity = Math.min(
        group.capacity ?? MAX_CHILDREN_PER_GROUP,
        group.room.capacity,
        MAX_CHILDREN_PER_GROUP
    );

    const where = { group_id: groupId };

    if (excludeChildId !== undefined && excludeChildId !== null) {
        where.id = { not: excludeChildId };
    }

    const childrenCount = await prisma.children.count({ where });

    if (childrenCount >= maxCapacity) {
        throw new AppError(
            409,
            `У групі немає вільних місць (максимум: ${maxCapacity})`
        );
    }
}

module.exports = { assertGroupHasCapacity };