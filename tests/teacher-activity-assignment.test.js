const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function createService({
    activity = { id: 1, name: "Музика" },
    employee = { id: 7, position: "TEACHER", subject: "Музика" },
    assignment = null,
    assignments = [],
    scheduledLesson = null
} = {}) {
    const prisma = {
        activities: {
            findUnique: async () => activity
        },
        employees: {
            findUnique: async () => employee
        },
        teacher_activities: {
            findUnique: async () => assignment,
            findMany: async () => assignments,
            create: async ({ data }) => data,
            delete: async ({ where }) => where.employee_id_activity_id
        },
        schedules: {
            findFirst: async () => scheduledLesson
        },
    };

    return proxyquire(
        "../src/modules/activities/activities.service.js",
        { "../../config/prisma": prisma }
    );
}

test("призначає викладача до дисципліни", async () => {
    const service = createService();
    const result = await service.assignTeacherToActivity(1, 7);

    assert.equal(result.activityId, 1);
    assert.equal(result.teacherId, 7);
});

test("відхиляє призначення працівника, який не є викладачем", async () => {
    const service = createService({
        employee: { id: 7, position: "EDUCATOR" }
    });

    await assert.rejects(
        service.assignTeacherToActivity(1, 7),
        (error) => error.code === "EMPLOYEE_NOT_TEACHER"
    );
});

test("відхиляє призначення до неіснуючої дисципліни", async () => {
    const service = createService({ activity: null });

    await assert.rejects(
        service.assignTeacherToActivity(1, 7),
        (error) => error.code === "ACTIVITY_NOT_FOUND"
    );
});

test("відхиляє призначення неіснуючого працівника", async () => {
    const service = createService({ employee: null });

    await assert.rejects(
        service.assignTeacherToActivity(1, 7),
        (error) => error.code === "TEACHER_NOT_FOUND"
    );
});

test("відхиляє повторне призначення викладача до дисципліни", async () => {
    const service = createService({
        assignment: { employee_id: 7, activity_id: 1 }
    });

    await assert.rejects(
        service.assignTeacherToActivity(1, 7),
        (error) => error.code === "TEACHER_ALREADY_ASSIGNED"
    );
});

test("повертає викладачів, призначених до дисципліни", async () => {
    const service = createService({
        assignments: [
            {
                employees: {
                    id: 7,
                    first_name: "Олена",
                    last_name: "Коваль",
                    subject: "Музика"
                }
            }
        ]
    });

    const result = await service.getTeachersForActivity(1);

    assert.deepEqual(result, [
        {
            id: 7,
            firstName: "Олена",
            lastName: "Коваль",
            subject: "Музика"
        }
    ]);
});

test("скасовує призначення викладача до дисципліни", async () => {
    const service = createService({
        assignment: { employee_id: 7, activity_id: 1 }
    });

    const result = await service.removeTeacherFromActivity(1, 7);

    assert.deepEqual(result, { activityId: 1, teacherId: 7 });
});

test("не скасовує призначення, використане в розкладі", async () => {
    const service = createService({
        assignment: { employee_id: 7, activity_id: 1 },
        scheduledLesson: { id: 12 }
    });

    await assert.rejects(
        service.removeTeacherFromActivity(1, 7),
        (error) => error.code === "TEACHER_ACTIVITY_IN_USE"
    );
});

test("відхиляє призначення викладача до іншої дисципліни", async () => {
    const service = createService({
        activity: { id: 1, name: "Математика" },
        employee: { id: 7, position: "TEACHER", subject: "Музика" }
    });

    await assert.rejects(
        service.assignTeacherToActivity(1, 7),
        (error) => error.code === "TEACHER_SUBJECT_MISMATCH"
    );
});

test("відхиляє призначення викладача до іншої дисципліни", async () => {
    const service = createService({
        activity: { id: 1, name: "Математика" },
        employee: { id: 7, position: "TEACHER", subject: "Музика" }
    });

    await assert.rejects(
        service.assignTeacherToActivity(1, 7),
        (error) => error.code === "TEACHER_SUBJECT_MISMATCH"
    );
});