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
    return proxyquire("../src/modules/rooms/rooms.controller.js", {
        "./rooms.service": service
    });
}

test("відхиляє некоректну місткість кімнати до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        createRoom: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.createRoom({
        body: { name: "Кімната 1", capacity: 0 }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "Місткість кімнати повинна бути додатним цілим числом"
        }
    });
    assert.equal(serviceCalled, false);
});

test("відхиляє некоректний ID кімнати до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        getRoomById: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.getRoomById({ params: { id: "abc" } }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "ID кімнати повинен бути додатним цілим числом"
        }
    });
    assert.equal(serviceCalled, false);
});

test("повертає список кімнат у полі data", async () => {
    const rooms = [{ id: 1, name: "Кімната 1" }];
    const controller = loadController({
        getRooms: async () => rooms
    });
    const res = createResponse();

    await controller.getRooms({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: rooms });
});

test("повертає створену кімнату у полі data зі статусом 201", async () => {
    const controller = loadController({
        createRoom: async data => ({ id: 1, ...data })
    });
    const res = createResponse();

    await controller.createRoom({
        body: { name: "Кімната 1", capacity: 15 }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, {
        data: {
            id: 1,
            name: "Кімната 1",
            capacity: 15
        }
    });
});