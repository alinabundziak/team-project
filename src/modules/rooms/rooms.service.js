const prisma = require("../../config/prisma");

function createRoomError(message, code, status) {
    const error = new Error(message);
    error.code = code;
    error.status = status;

    return error;
}

async function getRooms() {
    return prisma.rooms.findMany({
        orderBy: {
            id: "asc"
        }
    });
}

async function getRoomById(id) {
    const room = await prisma.rooms.findUnique({
        where: {
            id
        }
    });

    if (!room) {
        throw createRoomError(
            "Кімнату не знайдено",
            "ROOM_NOT_FOUND",
            404
        );
    }

    return room;
}

async function checkDuplicateName(name, excludeId) {
    const where = {
        name
    };

    if (excludeId !== undefined) {
        where.id = {
            not: excludeId
        };
    }

    const existingRoom = await prisma.rooms.findFirst({
        where,
        select: {
            id: true
        }
    });

    if (existingRoom) {
        throw createRoomError(
            "Кімната з такою назвою вже існує",
            "ROOM_DUPLICATE",
            409
        );
    }
}

async function createRoom(data) {
    await checkDuplicateName(data.name);

    const roomData = {
        name: data.name
    };

    if (data.capacity !== undefined) {
        roomData.capacity = data.capacity;
    }

    if (data.description !== undefined) {
        roomData.description = data.description;
    }

    return prisma.rooms.create({
        data: roomData
    });
}

async function updateRoom(id, data) {
    const existingRoom = await prisma.rooms.findUnique({
        where: {
            id
        }
    });

    if (!existingRoom) {
        throw createRoomError(
            "Кімнату не знайдено",
            "ROOM_NOT_FOUND",
            404
        );
    }

    if (data.name !== undefined) {
        await checkDuplicateName(data.name, id);
    }

    const roomData = {};

    if (data.name !== undefined) {
        roomData.name = data.name;
    }

    if (data.capacity !== undefined) {
        roomData.capacity = data.capacity;
    }

    if (data.description !== undefined) {
        roomData.description = data.description;
    }

    return prisma.rooms.update({
        where: {
            id
        },
        data: roomData
    });
}

async function deleteRoom(id) {
    const existingRoom = await prisma.rooms.findUnique({
        where: {
            id
        },
        select: {
            id: true
        }
    });

    if (!existingRoom) {
        throw createRoomError(
            "Кімнату не знайдено",
            "ROOM_NOT_FOUND",
            404
        );
    }

    const [groupsCount, schedulesCount] = await Promise.all([
        prisma.groups.count({
            where: {
                room_id: id
            }
        }),
        prisma.schedules.count({
            where: {
                room_id: id
            }
        })
    ]);

    if (groupsCount > 0 || schedulesCount > 0) {
        throw createRoomError(
            "Не можна видалити кімнату, яка використовується групою або розкладом",
            "ROOM_IN_USE",
            409
        );
    }

    return prisma.rooms.delete({
        where: {
            id
        }
    });
}

module.exports = {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
};