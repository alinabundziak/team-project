const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadService({
    room = { id: 1 },
    groupsCount = 0,
    schedulesCount = 0
} = {}) {
    let wasDeleted = false;

    const service = proxyquire("../src/modules/rooms/rooms.service.js", {
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
    });

    return { service, wasDeleted: () => wasDeleted };
}

test("видаляє приміщення без пов'язаних записів", async () => {
    const { service, wasDeleted } = loadService();

    await service.deleteRoom(1);

    assert.equal(wasDeleted(), true);
});

test("повертає 404, якщо приміщення не існує", async () => {
    const { service, wasDeleted } = loadService({ room: null });

    await assert.rejects(
        service.deleteRoom(1),
        error => error.code === "ROOM_NOT_FOUND" && error.status === 404
    );

    assert.equal(wasDeleted(), false);
});

for (const [label, countKey] of [
    ["групою", "groupsCount"],
    ["записом розкладу", "schedulesCount"]
]) {
    test(`не видаляє приміщення, пов'язане з ${label}`, async () => {
        const { service, wasDeleted } = loadService({
            [countKey]: 1
        });

        await assert.rejects(
            service.deleteRoom(1),
            error => error.code === "ROOM_IN_USE" && error.status === 409
        );

        assert.equal(wasDeleted(), false);
    });
}