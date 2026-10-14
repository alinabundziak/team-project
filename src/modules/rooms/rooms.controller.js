const service = require("./rooms.service");

function sendRoomError(res, status, message) {
    return res.status(status).json({
        error: {
            status,
            message
        }
    });
}

function handleRoomError(error, res) {
    if (error.code === "ROOM_NOT_FOUND" || error.code === "P2025") {
        return sendRoomError(
            res,
            404,
            error.message || "Кімнату не знайдено"
        );
    }

    if (error.code === "ROOM_DUPLICATE" || error.code === "P2002") {
        return sendRoomError(
            res,
            409,
            "Кімната з такою назвою вже існує"
        );
    }

    if (error.code === "ROOM_IN_USE" || error.code === "P2003") {
        return sendRoomError(
            res,
            409,
            "Не можна виконати операцію: кімната використовується групою або розкладом"
        );
    }

    if (error.status) {
        return sendRoomError(
            res,
            error.status,
            error.message
        );
    }

    console.error(error);

    return sendRoomError(
        res,
        500,
        "Внутрішня помилка сервера"
    );
}

function parseId(value) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function validateRoomData(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return {
            error: "Передайте дані кімнати у форматі JSON"
        };
    }

    const data = {};
    const has = (field) =>
        Object.prototype.hasOwnProperty.call(body, field);

    if (!partial || has("name")) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
            return {
                error: "Назва кімнати обов'язкова"
            };
        }

        data.name = body.name.trim();
    }

    if (has("capacity")) {
        if (
            !Number.isInteger(body.capacity) ||
            body.capacity <= 0
        ) {
            return {
                error: "Місткість кімнати повинна бути додатним цілим числом"
            };
        }

        data.capacity = body.capacity;
    }

    if (has("description")) {
        if (
            body.description !== null &&
            typeof body.description !== "string"
        ) {
            return {
                error: "Опис кімнати повинен бути текстом або null"
            };
        }

        data.description =
            typeof body.description === "string"
                ? body.description.trim()
                : null;
    }

    if (partial && Object.keys(data).length === 0) {
        return {
            error: "Передайте хоча б одне поле для зміни"
        };
    }

    return { data };
}

async function getRooms(req, res) {
    try {
        const rooms = await service.getRooms();

        return res.status(200).json(rooms);
    } catch (error) {
        return handleRoomError(error, res);
    }
}

async function getRoomById(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendRoomError(
            res,
            400,
            "ID кімнати повинен бути додатним цілим числом"
        );
    }

    try {
        const room = await service.getRoomById(id);

        return res.status(200).json(room);
    } catch (error) {
        return handleRoomError(error, res);
    }
}

async function createRoom(req, res) {
    const result = validateRoomData(req.body);

    if (result.error) {
        return sendRoomError(
            res,
            400,
            result.error
        );
    }

    try {
        const room = await service.createRoom(result.data);

        return res.status(201).json(room);
    } catch (error) {
        return handleRoomError(error, res);
    }
}

async function updateRoom(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendRoomError(
            res,
            400,
            "ID кімнати повинен бути додатним цілим числом"
        );
    }

    const result = validateRoomData(req.body, true);

    if (result.error) {
        return sendRoomError(
            res,
            400,
            result.error
        );
    }

    try {
        const room = await service.updateRoom(id, result.data);

        return res.status(200).json(room);
    } catch (error) {
        return handleRoomError(error, res);
    }
}

async function deleteRoom(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendRoomError(
            res,
            400,
            "ID кімнати повинен бути додатним цілим числом"
        );
    }

    try {
        await service.deleteRoom(id);

        return res.status(200).json({
            message: "Кімнату успішно видалено"
        });
    } catch (error) {
        return handleRoomError(error, res);
    }
}

module.exports = {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
};