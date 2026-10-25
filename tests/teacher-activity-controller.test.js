const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function createResponse() {
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

function loadController(service) {
    return proxyquire(
        "../src/modules/activities/activities.controller.js",
        { "./activities.service": service }
    );
}

test("повертає список викладачів дисципліни зі статусом 200", async () => {
    const controller = loadController({
        getTeachersForActivity: async () => [{ id: 7, firstName: "Олена" }]
    });
    const res = createResponse();

    await controller.getTeachers({ params: { id: "1" } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        activityId: 1,
        teachers: [{ id: 7, firstName: "Олена" }]
    });
});

test("призначає викладача зі статусом 201", async () => {
    const controller = loadController({
        assignTeacherToActivity: async () => ({ activityId: 1, teacherId: 7 })
    });
    const res = createResponse();

    await controller.assignTeacher(
        { params: { id: "1" }, body: { teacherId: 7 } },
        res
    );

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { activityId: 1, teacherId: 7 });
});

test("повертає 409, якщо призначення конфліктує", async () => {
    const controller = loadController({
        assignTeacherToActivity: async () => {
            const error = new Error("Викладач уже призначений");
            error.status = 409;
            throw error;
        }
    });
    const res = createResponse();

    await controller.assignTeacher(
        { params: { id: "1" }, body: { teacherId: 7 } },
        res
    );

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.message, "Викладач уже призначений");
});

test("відхиляє некоректний ID дисципліни зі статусом 400", async () => {
    const controller = loadController({});
    const res = createResponse();

    await controller.getTeachers({ params: { id: "abc" } }, res);

    assert.equal(res.statusCode, 400);
});

test("скасовує призначення зі статусом 200", async () => {
    const controller = loadController({
        removeTeacherFromActivity: async () => ({ activityId: 1, teacherId: 7 })
    });
    const res = createResponse();

    await controller.removeTeacher(
        { params: { id: "1", teacherId: "7" } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { activityId: 1, teacherId: 7 });
});