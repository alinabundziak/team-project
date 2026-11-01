const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadRoomDeletionService({
    room = { id: 1 },
    groupsCount = 0,
    schedulesCount = 0
} = {}) {
    let wasDeleted = false;

    const service = proxyquire(
        "../src/modules/rooms/rooms.service.js",
        {
            "../../config/prisma": {
                rooms: {
                    findUnique: async () => room,
                    delete: async ({ where }) => {
                        wasDeleted = true;
                        return { id: where.id };
                    }
                },
                groups: {
                    count: async () => groupsCount
                },
                schedules: {
                    count: async () => schedulesCount
                }
            }
        }
    );

    return { service, wasDeleted: () => wasDeleted };
}

test("видаляє приміщення без пов'язаних записів", async () => {
    const { service, wasDeleted } = loadRoomDeletionService();

    await service.deleteRoom(1);

    assert.equal(wasDeleted(), true);
});

test("повертає 404, якщо приміщення не існує", async () => {
    const { service, wasDeleted } =
        loadRoomDeletionService({ room: null });

    await assert.rejects(
        service.deleteRoom(1),
        error =>
            error.code === "ROOM_NOT_FOUND" &&
            error.status === 404
    );

    assert.equal(wasDeleted(), false);
});

for (const [label, countKey] of [
    ["групою", "groupsCount"],
    ["записом розкладу", "schedulesCount"]
]) {
    test(`не видаляє приміщення, пов'язане з ${label}`, async () => {
        const { service, wasDeleted } =
            loadRoomDeletionService({ [countKey]: 1 });

        await assert.rejects(
            service.deleteRoom(1),
            error =>
                error.code === "ROOM_IN_USE" &&
                error.status === 409
        );

        assert.equal(wasDeleted(), false);
    });
}

function createRoomsControllerResponse() {
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

function loadRoomsController(service) {
    return proxyquire(
        "../src/modules/rooms/rooms.controller.js",
        { "./rooms.service": service }
    );
}

test("відхиляє некоректну місткість кімнати до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadRoomsController({
        createRoom: async () => {
            serviceCalled = true;
        }
    });
    const res = createRoomsControllerResponse();

    await controller.createRoom(
        { body: { name: "Кімната 1", capacity: 0 } },
        res
    );

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
    const controller = loadRoomsController({
        getRoomById: async () => {
            serviceCalled = true;
        }
    });
    const res = createRoomsControllerResponse();

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
    const controller = loadRoomsController({
        getRooms: async () => rooms
    });
    const res = createRoomsControllerResponse();

    await controller.getRooms({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: rooms });
});

test("повертає створену кімнату у полі data зі статусом 201", async () => {
    const controller = loadRoomsController({
        createRoom: async data => ({ id: 1, ...data })
    });
    const res = createRoomsControllerResponse();

    await controller.createRoom(
        { body: { name: "Кімната 1", capacity: 15 } },
        res
    );

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, {
        data: {
            id: 1,
            name: "Кімната 1",
            capacity: 15
        }
    });
});