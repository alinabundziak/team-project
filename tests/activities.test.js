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

function createActivitiesControllerResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function loadActivitiesController(service) {
    return proxyquire(
        "../src/modules/activities/activities.controller.js",
        { "./activities.service": service }
    );
}

test("повертає список викладачів дисципліни зі статусом 200", async () => {
    const controller = loadActivitiesController({
        getTeachersForActivity: async () => [{ id: 7, firstName: "Олена" }]
    });
    const res = createActivitiesControllerResponse();

    await controller.getTeachers({ params: { id: "1" } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        data: {
            activityId: 1,
            teachers: [{ id: 7, firstName: "Олена" }]
        }
    });
});

test("призначає викладача зі статусом 201", async () => {
    const controller = loadActivitiesController({
        assignTeacherToActivity: async () => ({ activityId: 1, teacherId: 7 })
    });
    const res = createActivitiesControllerResponse();

    await controller.assignTeacher(
        { params: { id: "1" }, body: { teacherId: 7 } },
        res
    );

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { data: { activityId: 1, teacherId: 7 }});
});

test("повертає 409, якщо призначення конфліктує", async () => {
    const controller = loadActivitiesController({
        assignTeacherToActivity: async () => {
            const error = new Error("Викладач уже призначений");
            error.status = 409;
            throw error;
        }
    });
    const res = createActivitiesControllerResponse();

    await controller.assignTeacher(
        { params: { id: "1" }, body: { teacherId: 7 } },
        res
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.message, "Викладач уже призначений");
});

test("відхиляє некоректний ID дисципліни зі статусом 400", async () => {
    const controller = loadActivitiesController({});
    const res = createActivitiesControllerResponse();

    await controller.getTeachers({ params: { id: "abc" } }, res);

    assert.equal(res.statusCode, 400);
});

test("скасовує призначення зі статусом 200", async () => {
    const controller = loadActivitiesController({
        removeTeacherFromActivity: async () => ({ activityId: 1, teacherId: 7 })
    });
    const res = createActivitiesControllerResponse();

    await controller.removeTeacher(
        { params: { id: "1", teacherId: "7" } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: { activityId: 1, teacherId: 7 }});
});