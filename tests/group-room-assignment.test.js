const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadController() {
    const calls = [];

    const controller = proxyquire(
        "../src/modules/groups/groups.controller.js",
        {
            "./groups.service": {
                createGroup: async data => {
                    calls.push(data);
                    return { id: 1, ...data };
                },
                updateGroup: async (id, data) => {
                    calls.push({ id, ...data });
                    return { id, ...data };
                }
            }
        }
    );

    return { controller, calls };
}

function makeResponse() {
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

test("не дозволяє створити групу без базового приміщення", async () => {
    const { controller, calls } = loadController();
    const res = makeResponse();

    await controller.createGroup({
        body: { name: "Молодша", ageYears: 3 }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});

test("приймає ID базового приміщення під час створення групи", async () => {
    const { controller, calls } = loadController();
    const res = makeResponse();

    await controller.createGroup({
        body: {
            name: "Молодша",
            ageYears: 3,
            roomId: 5
        }
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(calls[0].roomId, 5);
});

test("не дозволяє прибрати базове приміщення під час оновлення групи", async () => {
    const { controller, calls } = loadController();
    const res = makeResponse();

    await controller.updateGroup({
        params: { id: "1" },
        body: { roomId: null }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});