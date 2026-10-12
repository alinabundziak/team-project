const service = require("./groups.service");

function sendGroupError(res, status, message) {
    return res.status(status).json({
        error: {
            status,
            message
        }
    });
}

function handleGroupError(error, res) {
    if (error.code === "P2002") {
        return sendGroupError(
            res,
            409,
            "Такий запис або зв'язок уже існує"
        );
    }

    if (error.code === "P2025" || error.status === 404) {
        return sendGroupError(
            res,
            404,
            error.message || "Ресурс не знайдено"
        );
    }

    if (error.code === "P2003") {
        return sendGroupError(
            res,
            409,
            "Операцію неможливо виконати через пов'язані записи"
        );
    }

    if (error.status) {
        return sendGroupError(
            res,
            error.status,
            error.message
        );
    }

    console.error(error);

    return sendGroupError(
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

function validateGroupData(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return {
            error: "Передайте дані групи у форматі JSON"
        };
    }

    const data = {};
    const has = (field) =>
        Object.prototype.hasOwnProperty.call(body, field);

    if (!partial || has("name")) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
            return {
                error: "Назва групи обов'язкова"
            };
        }

        data.name = body.name.trim();
    }

    if (!partial || has("ageYears")) {
        if (
            !Number.isInteger(body.ageYears) ||
            body.ageYears < 2 ||
            body.ageYears > 5
        ) {
            return {
                error: "Вік групи повинен бути цілим числом від 2 до 5"
            };
        }

        data.ageYears = body.ageYears;
    }

    if (has("capacity")) {
        if (
            !Number.isInteger(body.capacity) ||
            body.capacity < 1 ||
            body.capacity > 20
        ) {
            return {
                error: "Місткість групи повинна бути від 1 до 20 дітей"
            };
        }

        data.capacity = body.capacity;
    }

    if (!partial || has("roomId")) {
    if (!Number.isInteger(body.roomId) || body.roomId <= 0) {
        return {
            error: "ID базової кімнати повинен бути додатним цілим числом"
        };
    }

    data.roomId = body.roomId;
}

    if (partial && Object.keys(data).length === 0) {
        return {
            error: "Передайте хоча б одне поле для зміни"
        };
    }

    return { data };
}

async function getGroups(req, res) {
    try {
        const groups = await service.getGroups();

        return res.status(200).json(groups);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function createGroup(req, res) {
    const result = validateGroupData(req.body);

    if (result.error) {
        return res.status(400).json({
            error: result.error
        });
    }

    try {
        const group = await service.createGroup(result.data);

        return res.status(201).json(group);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function getGroupById(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendGroupError(
            res,
            400,
            "ID групи повинен бути додатним цілим числом"
        );
    }

    try {
        const group = await service.getGroupById(id);

        return res.status(200).json(group);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function updateGroup(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendGroupError(
            res,
            400,
            "ID групи повинен бути додатним цілим числом"
        );
    }

    const result = validateGroupData(req.body, true);

    if (result.error) {
        return res.status(400).json({
            error: result.error
        });
    }

    try {
        const group = await service.updateGroup(id, result.data);

        return res.status(200).json(group);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function deleteGroup(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendGroupError(
            res,
            400,
            "ID групи повинен бути додатним цілим числом"
        );
    }

    try {
        await service.deleteGroup(id);

        return res.status(200).json({
            message: "Групу успішно видалено"
        });
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function getGroupChildren(req, res) {
    const groupId = parseId(req.params.id);

    if (groupId === null) {
        return res.status(400).json({
            error: "Некоректний ID групи"
        });
    }

    try {
        const children = await service.getGroupChildren(groupId);

        return res.status(200).json(children);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function addChildToGroup(req, res) {
    const groupId = parseId(req.params.id);
    const childId = req.body?.childId;

    if (groupId === null) {
        return res.status(400).json({
            error: "Некоректний ID групи"
        });
    }

    if (!Number.isInteger(childId) || childId <= 0) {
        return res.status(400).json({
            error: "childId повинен бути додатним цілим числом"
        });
    }

    try {
        const child = await service.addChildToGroup(groupId, childId);

        return res.status(200).json(child);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function removeChildFromGroup(req, res) {
    const groupId = parseId(req.params.id);
    const childId = parseId(req.params.childId);

    if (groupId === null || childId === null) {
        return res.status(400).json({
            error: "ID групи та дитини повинні бути додатними цілими числами"
        });
    }

    try {
        await service.removeChildFromGroup(groupId, childId);

        return res.status(200).json({
            message: "Дитину виключено з групи"
        });
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function assignStaffToGroup(req, res) {
    const groupId = parseId(req.params.id);
    const staffId = req.body?.staffId;

    if (groupId === null) {
        return res.status(400).json({
            error: "Некоректний ID групи"
        });
    }

    if (!Number.isInteger(staffId) || staffId <= 0) {
        return res.status(400).json({
            error: "staffId повинен бути додатним цілим числом"
        });
    }

    try {
        const assignment = await service.assignStaffToGroup(
            groupId,
            staffId
        );

        return res.status(201).json(assignment);
    } catch (error) {
        return handleGroupError(error, res);
    }
}

async function removeStaffFromGroup(req, res) {
    const groupId = parseId(req.params.id);
    const staffId = parseId(req.params.staffId);

    if (groupId === null || staffId === null) {
        return res.status(400).json({
            error: "Некоректний ID групи або працівника"
        });
    }

    try {
        await service.removeStaffFromGroup(groupId, staffId);

        return res.status(200).json({
            message: "Призначення працівника скасовано"
        });
    } catch (error) {
        return handleGroupError(error, res);
    }
}

module.exports = {
    getGroups,
    createGroup,
    getGroupById,
    updateGroup,
    deleteGroup,
    getGroupChildren,
    addChildToGroup,
    removeChildFromGroup,
    assignStaffToGroup,
    removeStaffFromGroup
};