const prisma = require("../../config/prisma");

function createActivityError(message, code, status) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

async function assignTeacherToActivity(activityId, teacherId) {
    const [activity, teacher] = await Promise.all([
        prisma.activities.findUnique({
            where: { id: activityId },
            select: { id: true, name: true }
        }),
        prisma.employees.findUnique({
            where: { id: teacherId },
            select: { id: true, position: true, subject: true }
        })
    ]);

    if (!activity) {
        throw createActivityError(
            "Дисципліну не знайдено",
            "ACTIVITY_NOT_FOUND",
            404
        );
    }

    if (!teacher) {
        throw createActivityError(
            "Викладача не знайдено",
            "TEACHER_NOT_FOUND",
            404
        );
    }

    if (teacher.position !== "TEACHER") {
        throw createActivityError(
            "До дисципліни можна призначити лише викладача",
            "EMPLOYEE_NOT_TEACHER",
            409
        );
    }

        const teacherSubject = teacher.subject?.trim().toLocaleLowerCase("uk-UA");
        const activityName = activity.name?.trim().toLocaleLowerCase("uk-UA");

        if (!teacherSubject || teacherSubject !== activityName) {
            throw createActivityError(
                "Предмет викладача не відповідає дисципліні",
                "TEACHER_SUBJECT_MISMATCH",
                409
            );
        }

    const existingAssignment =
        await prisma.teacher_activities.findUnique({
            where: {
                employee_id_activity_id: {
                    employee_id: teacherId,
                    activity_id: activityId
                }
            }
        });

    if (existingAssignment) {
        throw createActivityError(
            "Викладач уже призначений до цієї дисципліни",
            "TEACHER_ALREADY_ASSIGNED",
            409
        );
    }

    const assignment = await prisma.teacher_activities.create({
        data: {
            employee_id: teacherId,
            activity_id: activityId
        },
        select: {
            employee_id: true,
            activity_id: true
        }
    });

    return {
        activityId: assignment.activity_id,
        teacherId: assignment.employee_id
    };
}

async function getTeachersForActivity(activityId) {
    const activity = await prisma.activities.findUnique({
        where: { id: activityId },
        select: { id: true }
    });

    if (!activity) {
        throw createActivityError(
            "Дисципліну не знайдено",
            "ACTIVITY_NOT_FOUND",
            404
        );
    }

    const assignments = await prisma.teacher_activities.findMany({
        where: { activity_id: activityId },
        select: {
            employees: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    subject: true
                }
            }
        }
    });

    return assignments.map(({ employees }) => ({
        id: employees.id,
        firstName: employees.first_name,
        lastName: employees.last_name,
        subject: employees.subject
    }));
}

async function removeTeacherFromActivity(activityId, teacherId) {
    const activity = await prisma.activities.findUnique({
        where: { id: activityId },
        select: { id: true }
    });

    if (!activity) {
        throw createActivityError(
            "Дисципліну не знайдено",
            "ACTIVITY_NOT_FOUND",
            404
        );
    }

    const assignment = await prisma.teacher_activities.findUnique({
        where: {
            employee_id_activity_id: {
                employee_id: teacherId,
                activity_id: activityId
            }
        }
    });

    if (!assignment) {
        throw createActivityError(
            "Призначення викладача не знайдено",
            "TEACHER_ASSIGNMENT_NOT_FOUND",
            404
        );
    }

    const scheduledLesson = await prisma.schedules.findFirst({
        where: {
            teacher_id: teacherId,
            activity_id: activityId
        },
        select: { id: true }
    });

    if (scheduledLesson) {
        throw createActivityError(
            "Не можна скасувати призначення, яке використовується в розкладі",
            "TEACHER_ACTIVITY_IN_USE",
            409
        );
    }

    await prisma.teacher_activities.delete({
        where: {
            employee_id_activity_id: {
                employee_id: teacherId,
                activity_id: activityId
            }
        }
    });

    return { activityId, teacherId };
}

module.exports = {
    assignTeacherToActivity,
    getTeachersForActivity,
    removeTeacherFromActivity
};