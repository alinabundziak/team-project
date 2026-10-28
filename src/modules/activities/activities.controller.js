const service = require("./activities.service");

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function sendError(res, error) {
    const status = error.status || 500;

    return res.status(status).json({
        error: {
            status,
            message: error.message || "Внутрішня помилка сервера"
        }
    });
}

async function getTeachers(req, res) {
    const activityId = parseId(req.params.id);

    if (!activityId) {
        return res.status(400).json({
            error: { status: 400, message: "Некоректний ID дисципліни" }
        });
    }

    try {
        const teachers = await service.getTeachersForActivity(activityId);
        return res.status(200).json({ data: { activityId, teachers } });
    } catch (error) {
        return sendError(res, error);
    }
}

async function assignTeacher(req, res) {
    const activityId = parseId(req.params.id);
    const teacherId = parseId(req.body?.teacherId);

    if (!activityId || !teacherId) {
        return res.status(400).json({
            error: {
                status: 400,
                message: "Передайте коректні ID дисципліни та викладача"
            }
        });
    }

    try {
        const assignment = await service.assignTeacherToActivity(
            activityId,
            teacherId
        );
        return res.status(201).json({ data: assignment });
    } catch (error) {
        return sendError(res, error);
    }
}

async function removeTeacher(req, res) {
    const activityId = parseId(req.params.id);
    const teacherId = parseId(req.params.teacherId);

    if (!activityId || !teacherId) {
        return res.status(400).json({
            error: {
                status: 400,
                message: "Передайте коректні ID дисципліни та викладача"
            }
        });
    }

    try {
        const result = await service.removeTeacherFromActivity(
            activityId,
            teacherId
        );
        return res.status(200).json({ data: result });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    getTeachers,
    assignTeacher,
    removeTeacher
};