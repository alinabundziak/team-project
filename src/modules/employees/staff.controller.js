const service = require("./staff.service");
const { ROLES } = require("../../config/roles");
const validPositions = ["TEACHER", "EDUCATOR", "ASSISTANT"];

function sendStaffError(res, status, message) {
    return res.status(status).json({
        error: {
            status,
            message
        }
    });
}

function parseId(value) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function handleStaffError(error, res) {
    if (
        error.code === "P2025" ||
        error.code === "STAFF_NOT_FOUND"
    ) {
        return sendStaffError(
            res,
            404,
            error.message || "Працівника не знайдено"
        );
    }

    if (error.code === "P2002") {
        return sendStaffError(
            res,
            409,
            "Такий запис працівника вже існує"
        );
    }

    if (error.code === "STAFF_IN_USE") {
        return sendStaffError(
            res,
            409,
            "Не можна видалити працівника, який використовується у групах або розкладі"
        );
    }

    if (error.code === "P2003") {
        return sendStaffError(
            res,
            409,
            "Операція порушує зв'язок з іншим записом"
        );
    }

    if (error.status) {
        return sendStaffError(
            res,
            error.status,
            error.message
        );
    }

    console.error(error);

    return sendStaffError(
        res,
        500,
        "Внутрішня помилка сервера"
    );
}

function checkSalaryAccess(req, res) {
    if (
        req.body &&
        Object.prototype.hasOwnProperty.call(req.body, "monthlySalary") &&
        req.user.role !== ROLES.ADMIN
    ) {
        sendStaffError(
            res,
            403,
            "Лише адміністратор може змінювати зарплату"
        );

        return false;
    }

    return true;
}

function validateStaffData(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return {
            error: "Передайте дані працівника у форматі JSON"
        };
    }

    const data = {};
    const has = (field) =>
        Object.prototype.hasOwnProperty.call(body, field);

    if (!partial || has("firstName")) {
        if (
            typeof body.firstName !== "string" ||
            body.firstName.trim() === ""
        ) {
            return {
                error: "Ім'я працівника обов'язкове"
            };
        }

        data.firstName = body.firstName.trim();
    }

    if (!partial || has("lastName")) {
        if (
            typeof body.lastName !== "string" ||
            body.lastName.trim() === ""
        ) {
            return {
                error: "Прізвище працівника обов'язкове"
            };
        }

        data.lastName = body.lastName.trim();
    }

    if (!partial || has("position")) {
        if (!validPositions.includes(body.position)) {
            return {
                error: "Посада повинна бути TEACHER, EDUCATOR або ASSISTANT"
            };
        }

        data.position = body.position;
    }

    if (has("phone")) {
        if (
            body.phone !== null &&
            typeof body.phone !== "string"
        ) {
            return {
                error: "Телефон повинен бути текстом або null"
            };
        }

        data.phone =
            typeof body.phone === "string" && body.phone.trim() !== ""
                ? body.phone.trim()
                : null;
    }

    if (has("subject")) {
        if (
            body.subject !== null &&
            typeof body.subject !== "string"
        ) {
            return {
                error: "Предмет повинен бути текстом або null"
            };
        }

        data.subject =
            typeof body.subject === "string" && body.subject.trim() !== ""
                ? body.subject.trim()
                : null;
    }

    if (has("userId")) {
    if (
        body.userId !== null &&
        (!Number.isInteger(body.userId) || body.userId <= 0)
    ) {
        return {
            error: "userId повинен бути додатним цілим числом або null"
        };
    }

    data.userId = body.userId;
}

    if (has("monthlySalary")) {
        const salary = body.monthlySalary;

        if (
            typeof salary !== "number" ||
            !Number.isFinite(salary) ||
            salary < 0 ||
            salary > 99999999.99 ||
            Math.abs(salary * 100 - Math.round(salary * 100)) > 0.000001
        ) {
            return {
                error: "Місячна зарплата повинна бути невід'ємним числом із двома знаками після коми"
            };
        }

        data.monthlySalary = salary;
    }

    if (partial && Object.keys(data).length === 0) {
        return {
            error: "Передайте хоча б одне поле для зміни"
        };
    }

    return { data };
}

async function getStaff(req, res) {
    try {
        const includeSalary = req.user.role === ROLES.ADMIN;
        const staff = await service.getStaff(includeSalary);

        return res.status(200).json(staff);
    } catch (error) {
        return handleStaffError(error, res);
    }
}

async function getStaffById(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendStaffError(
            res,
            400,
            "ID працівника повинен бути додатним цілим числом"
        );
    }

    try {
        const includeSalary = req.user.role === ROLES.ADMIN;
        const staff = await service.getStaffById(id, includeSalary);

        return res.status(200).json(staff);
    } catch (error) {
        return handleStaffError(error, res);
    }
}

async function createStaff(req, res) {
    const result = validateStaffData(req.body);

    if (!checkSalaryAccess(req, res)) {
        return;
    }

    if (result.error) {
        return sendStaffError(
            res,
            400,
            result.error
        );
    }

    try {
        const includeSalary = req.user.role === ROLES.ADMIN;
        const staff = await service.createStaff(result.data, includeSalary);

        return res.status(201).json(staff);
    } catch (error) {
        return handleStaffError(error, res);
    }
}

async function updateStaff(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendStaffError(
            res,
            400,
            "ID працівника повинен бути додатним цілим числом"
        );
    }

    if (!checkSalaryAccess(req, res)) {
        return;
    }

    const result = validateStaffData(req.body, true);

    if (result.error) {
        return sendStaffError(
            res,
            400,
            result.error
        );
    }

    try {
        const includeSalary = req.user.role === ROLES.ADMIN;
        const staff = await service.updateStaff(id, result.data, includeSalary);

        return res.status(200).json(staff);
    } catch (error) {
        return handleStaffError(error, res);
    }
}

async function deleteStaff(req, res) {
    const id = parseId(req.params.id);

    if (id === null) {
        return sendStaffError(
            res,
            400,
            "ID працівника повинен бути додатним цілим числом"
        );
    }

    try {
        await service.deleteStaff(id);

        return res.status(200).json({
            message: "Працівника успішно видалено"
        });
    } catch (error) {
        return handleStaffError(error, res);
    }
}

module.exports = {
    getStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff
};