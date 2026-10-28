const prisma = require("../../config/prisma");

const groupInclude = {
    room: {
        select: {
            id: true,
            name: true,
            capacity: true,
            description: true
        }
    },
    _count: {
        select: {
            children: true,
            staff_assignments: true,
            schedules: true
        }
    }
};

function createServiceError(message, code, status) {
    const error = new Error(message);
    error.code = code;
    error.status = status;

    return error;
}

function formatGroup(group) {
    const assignments = group.staff_assignments || [];

    return {
        id: group.id,
        name: group.name,
        ageYears: group.target_age,
        capacity: group.capacity,
        roomId: group.room_id,
        educatorId:
            assignments.find(assignment => assignment.role === "EDUCATOR")
                ?.employee_id ?? null,
        assistantId:
            assignments.find(assignment => assignment.role === "ASSISTANT")
                ?.employee_id ?? null,
        room: group.room,
        childrenCount: group._count.children,
        staffAssignmentsCount: group._count.staff_assignments,
        schedulesCount: group._count.schedules
    };
}

function calculateAge(birthDate) {
    const today = new Date();

    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();

    const monthDifference =
        today.getUTCMonth() - birthDate.getUTCMonth();

    if (
        monthDifference < 0 ||
        (
            monthDifference === 0 &&
            today.getUTCDate() < birthDate.getUTCDate()
        )
    ) {
        age--;
    }

    return age;
}

function formatChild(child) {
    return {
        id: child.id,
        firstName: child.first_name,
        lastName: child.last_name,
        dateOfBirth: child.birth_date.toISOString().slice(0, 10),
        groupId: child.group_id
    };
}

async function getRoom(roomId) {
    if (!Number.isInteger(roomId) || roomId <= 0) {
        throw createServiceError(
            "ID базової кімнати повинен бути додатним цілим числом",
            "INVALID_ROOM_ID",
            400
        );
    }

    const room = await prisma.rooms.findUnique({
        where: { id: roomId },
        select: {
            id: true,
            name: true,
            capacity: true,
            description: true
        }
    });

    if (!room) {
        throw createServiceError(
            "Кімнату не знайдено",
            "ROOM_NOT_FOUND",
            404
        );
    }

    return room;
}

async function checkRoomAvailability(roomId, excludeGroupId) {

    const where = { room_id: roomId };

    if (excludeGroupId !== undefined) {
        where.id = { not: excludeGroupId };
    }

    const existingGroup = await prisma.groups.findFirst({
        where,
        select: { id: true }
    });

    if (existingGroup) {
        throw createServiceError(
            "Ця кімната вже є базовою для іншої групи",
            "ROOM_ALREADY_ASSIGNED",
            409
        );
    }
}

async function getGroupsOccupancy() {
    const groups = await prisma.groups.findMany({
        include: {
            room: {
                select: {
                    id: true,
                    name: true,
                    capacity: true
                }
            },
            _count: {
                select: {
                    children: true
                }
            }
        },
        orderBy: {
            id: "asc"
        }
    });

    return groups.map(group => {
        const childrenCount = group._count.children;
        const groupCapacity = group.capacity;
        const roomCapacity = group.room?.capacity ?? groupCapacity;

        return {
            groupId: group.id,
            groupName: group.name,
            ageYears: group.target_age,
            childrenCount,
            groupCapacity,
            room: group.room
                ? {
                    id: group.room.id,
                    name: group.room.name,
                    capacity: group.room.capacity
                }
                : null,
            occupancyPercent: groupCapacity > 0
                ? Math.round(childrenCount / groupCapacity * 10000) / 100
                : null,
            exceedsGroupCapacity: childrenCount > groupCapacity,
            exceedsRoomCapacity:
                group.room?.capacity != null &&
                childrenCount > group.room.capacity,
            isOverCapacity:
                childrenCount > groupCapacity ||
                childrenCount > roomCapacity
        };
    });
}

async function getGroups() {
    const groups = await prisma.groups.findMany({
        include: groupInclude,
        orderBy: { id: "asc" }
    });

    return groups.map(formatGroup);
}

async function getGroupById(id) {
    const group = await prisma.groups.findUnique({
        where: { id },
        include: groupInclude
    });

    if (!group) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    return formatGroup(group);
}

async function createGroup(data) {
    const capacity = data.capacity ?? 20;
    const roomId = data.roomId;

    await getRoom(roomId);

    await checkRoomAvailability(roomId);

    const group = await prisma.groups.create({
        data: {
            name: data.name,
            target_age: data.ageYears,
            capacity,
            room_id: roomId
        },
        include: groupInclude
    });

    return formatGroup(group);
}

async function updateGroup(id, data) {
    const existingGroup = await prisma.groups.findUnique({
        where: { id },
        select: {
            id: true,
            target_age: true,
            capacity: true,
            room_id: true
        }
    });

    if (!existingGroup) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    const effectiveCapacity =
        data.capacity ?? existingGroup.capacity;

    const effectiveRoomId =
        data.roomId !== undefined
            ? data.roomId
            : existingGroup.room_id;

    const room = await getRoom(effectiveRoomId);

    if (data.roomId !== undefined) {
        await checkRoomAvailability(effectiveRoomId, id);
    }

    const childrenCount = await prisma.children.count({
        where: { group_id: id }
    });

    if (effectiveCapacity < childrenCount) {
        throw createServiceError(
            "Місткість не може бути меншою за поточну кількість дітей",
            "GROUP_CAPACITY_BELOW_CHILDREN",
            409
        );
    }

    if (
        data.ageYears !== undefined &&
        data.ageYears !== existingGroup.target_age
    ) {
        const children = await prisma.children.findMany({
            where: { group_id: id },
            select: { birth_date: true }
        });

        const hasAgeMismatch = children.some(
            child => calculateAge(child.birth_date) !== data.ageYears
        );

        if (hasAgeMismatch) {
            throw createServiceError(
                "Не можна змінити вік групи: вік однієї або кількох дітей не відповідатиме новому віку",
                "GROUP_AGE_CONFLICT",
                409
            );
        }
    }

    const updateData = {};

    if (data.name !== undefined) {
        updateData.name = data.name;
    }

    if (data.ageYears !== undefined) {
        updateData.target_age = data.ageYears;
    }

    if (data.capacity !== undefined) {
        updateData.capacity = data.capacity;
    }

    if (data.roomId !== undefined) {
        updateData.room_id = data.roomId;
    }

    const updatedGroup = await prisma.groups.update({
        where: { id },
        data: updateData,
        include: groupInclude
    });

    return formatGroup(updatedGroup);
}

async function deleteGroup(id) {
    const group = await prisma.groups.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!group) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    const [childrenCount, assignmentCount, schedulesCount] =
        await Promise.all([
            prisma.children.count({
                where: { group_id: id }
            }),
            prisma.staff_assignments.count({
                where: { group_id: id }
            }),
            prisma.schedules.count({
                where: { group_id: id }
            })
        ]);

    if (
        childrenCount > 0 ||
        assignmentCount > 0 ||
        schedulesCount > 0
    ) {
        throw createServiceError(
            "Не можна видалити групу, поки до неї прив'язані діти, працівники або записи розкладу",
            "GROUP_IN_USE",
            409
        );
    }

    return prisma.groups.delete({
        where: { id }
    });
}

async function getGroupChildren(groupId) {
    const group = await prisma.groups.findUnique({
        where: { id: groupId },
        select: { id: true }
    });

    if (!group) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    const children = await prisma.children.findMany({
        where: { group_id: groupId },
        select: {
            id: true,
            first_name: true,
            last_name: true,
            birth_date: true,
            group_id: true
        },
        orderBy: { id: "asc" }
    });

    return children.map(formatChild);
}

async function addChildToGroup(groupId, childId) {
    const group = await prisma.groups.findUnique({
        where: { id: groupId },
        select: {
            id: true,
            target_age: true,
            capacity: true,
            room: {
                select: {
                    capacity: true
                }
            }
        }
    });

    if (!group) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    if (!group.room) {
        throw createServiceError(
            "Для групи не призначено базове приміщення",
            "GROUP_ROOM_REQUIRED",
            409
        );
    }

    const child = await prisma.children.findUnique({
        where: { id: childId },
        select: {
            id: true,
            first_name: true,
            last_name: true,
            birth_date: true,
            group_id: true
        }
    });

    if (!child) {
        throw createServiceError(
            "Дитину не знайдено",
            "CHILD_NOT_FOUND",
            404
        );
    }

    if (child.group_id === groupId) {
        throw createServiceError(
            "Дитина вже належить до цієї групи",
            "CHILD_ALREADY_IN_GROUP",
            409
        );
    }

    const childAge = calculateAge(child.birth_date);

    if (childAge < 2 || childAge > 5) {
        throw createServiceError(
            "Вік дитини повинен бути від 2 до 5 років",
            "CHILD_AGE_OUT_OF_RANGE",
            409
        );
    }

    if (childAge !== group.target_age) {
        throw createServiceError(
            "Вік дитини не відповідає віку групи",
            "CHILD_AGE_MISMATCH",
            409
        );
    }

    const childrenCount = await prisma.children.count({
        where: { group_id: groupId }
    });

    const maxCapacity = Math.min(
        group.capacity ?? 20,
        group.room.capacity ?? group.capacity ?? 20,
        20
    );

    if (childrenCount >= maxCapacity) {
            throw createServiceError(
                "У групі немає вільних місць",
                "GROUP_FULL",
                409
            );
    }

    const updatedChild = await prisma.children.update({
        where: { id: childId },
        data: { group_id: groupId },
        select: {
            id: true,
            first_name: true,
            last_name: true,
            birth_date: true,
            group_id: true
        }
    });

    return formatChild(updatedChild);
}

async function removeChildFromGroup(groupId, childId) {
    const group = await prisma.groups.findUnique({
        where: { id: groupId },
        select: { id: true }
    });

    if (!group) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    const child = await prisma.children.findUnique({
        where: { id: childId },
        select: {
            id: true,
            group_id: true
        }
    });

    if (!child) {
        throw createServiceError(
            "Дитину не знайдено",
            "CHILD_NOT_FOUND",
            404
        );
    }

    if (child.group_id !== groupId) {
        throw createServiceError(
            "Дитина не належить до вказаної групи",
            "CHILD_NOT_IN_GROUP",
            409
        );
    }

    await prisma.children.update({
        where: { id: childId },
        data: { group_id: null }
    });
}

async function assignStaffToGroup(groupId, staffId) {
    const [group, staff] = await Promise.all([
        prisma.groups.findUnique({
            where: { id: groupId },
            select: { id: true }
        }),
        prisma.employees.findUnique({
            where: { id: staffId },
            select: {
                id: true,
                position: true
            }
        })
    ]);

    if (!group) {
        throw createServiceError(
            "Групу не знайдено",
            "GROUP_NOT_FOUND",
            404
        );
    }

    if (!staff) {
        throw createServiceError(
            "Працівника не знайдено",
            "STAFF_NOT_FOUND",
            404
        );
    }

    if (!["EDUCATOR", "ASSISTANT"].includes(staff.position)) {
        throw createServiceError(
            "До групи можна призначити лише вихователя або помічника",
            "STAFF_POSITION_NOT_ALLOWED",
            409
        );
    }

    const assignedToAnotherGroup = await prisma.groups.findFirst({
        where: {
            id: { not: groupId },
            OR: [
                {
                    staff_assignments: {
                        some: { employee_id: staffId }
                    }
                },
                {
                    schedules: {
                        some: { teacher_id: staffId }
                    }
                }
            ]
        },
        select: { id: true }
    });

    if (assignedToAnotherGroup) {
        throw createServiceError(
            "Працівник уже пов'язаний з іншою групою",
            "STAFF_ASSIGNED_TO_ANOTHER_GROUP",
            409
        );
    }

    const existingAssignment =
        await prisma.staff_assignments.findUnique({
            where: {
                employee_id_group_id: {
                    employee_id: staffId,
                    group_id: groupId
                }
            }
        });

    if (existingAssignment) {
        throw createServiceError(
            "Цей працівник уже призначений до групи",
            "STAFF_ALREADY_ASSIGNED",
            409
        );
    }

    const assignment = await prisma.staff_assignments.create({
        data: {
            employee_id: staffId,
            group_id: groupId,
            role: staff.position
        },
        select: {
            employee_id: true,
            group_id: true,
            role: true,
            created_at: true
        }
    });

    return {
        staffId: assignment.employee_id,
        groupId: assignment.group_id,
        role: assignment.role,
        assignedAt: assignment.created_at
    };
}

async function removeStaffFromGroup(groupId, staffId) {
    const assignment =
        await prisma.staff_assignments.findUnique({
            where: {
                employee_id_group_id: {
                    employee_id: staffId,
                    group_id: groupId
                }
            }
        });

    if (!assignment) {
        throw createServiceError(
            "Призначення працівника до цієї групи не знайдено",
            "STAFF_ASSIGNMENT_NOT_FOUND",
            404
        );
    }

    await prisma.staff_assignments.delete({
        where: {
            employee_id_group_id: {
                employee_id: staffId,
                group_id: groupId
            }
        }
    });
}

module.exports = {
    getGroupsOccupancy,
    getGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupChildren,
    addChildToGroup,
    removeChildFromGroup,
    assignStaffToGroup,
    removeStaffFromGroup
};