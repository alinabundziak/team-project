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
    return proxyquire("../src/modules/groups/groups.controller.js", {
        "./groups.service": service
    });
}

test("відхиляє некоректну групу до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        createGroup: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.createGroup({
        body: {
            name: " ",
            ageYears: 3,
            capacity: 20,
            roomId: 1
        }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "Назва групи обов'язкова"
        }
    });
    assert.equal(serviceCalled, false);
});

test("відхиляє некоректний ID групи до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        getGroupById: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.getGroupById({ params: { id: "abc" } }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "ID групи повинен бути додатним цілим числом"
        }
    });
    assert.equal(serviceCalled, false);
});

test("відхиляє некоректний ID дитини до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        addChildToGroup: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.addChildToGroup({
        params: { id: "1" },
        body: { childId: "7" }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "childId повинен бути додатним цілим числом"
        }
    });
    assert.equal(serviceCalled, false);
});

test("повертає 201 при призначенні дитини до групи", async () => {
    let receivedIds;
    const controller = loadController({
        addChildToGroup: async (groupId, childId) => {
            receivedIds = { groupId, childId };
            return { id: childId };
        }
    });
    const res = createResponse();

    await controller.addChildToGroup({
        params: { id: "1" },
        body: { childId: 7 }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { data: { id: 7 } });
    assert.deepEqual(receivedIds, { groupId: 1, childId: 7 });
});

test("повертає скасування призначення працівника у полі data", async () => {
    const controller = loadController({
        removeStaffFromGroup: async () => {}
    });
    const res = createResponse();

    await controller.removeStaffFromGroup({
        params: { id: "1", staffId: "7" }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        data: {
            message: "Призначення працівника скасовано"
        }
    });
});