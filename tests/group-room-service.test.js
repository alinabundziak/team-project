const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadService({ room, assignedGroup = null } = {}) {
    const testRoom = room === undefined
        ? { id: 5, name: "Кімната 5", capacity: 20, description: null }
        : room;

    let createdData;

    const service = proxyquire("../src/modules/groups/groups.service.js", {
        "../../config/prisma": {
            rooms: {
                findUnique: async () => testRoom
            },
            groups: {
                findFirst: async () => assignedGroup,
                create: async ({ data }) => {
                    createdData = data;
                    return {
                        id: 1,
                        ...data,
                        educator_id: null,
                        assistant_id: null,
                        room: testRoom,
                        _count: {
                            children: 0,
                            staff_assignments: 0,
                            schedules: 0
                        }
                    };
                }
            }
        }
    });

    return {
        service,
        getCreatedData: () => createdData
    };
}

const groupData = {
    name: "Молодша",
    ageYears: 3,
    roomId: 5
};

test("створює групу з наявним базовим приміщенням", async () => {
    const { service, getCreatedData } = loadService();

    const group = await service.createGroup(groupData);

    assert.equal(group.roomId, 5);
    assert.equal(getCreatedData().room_id, 5);
});

test("не створює групу з неіснуючим приміщенням", async () => {
    const { service } = loadService({ room: null });

    await assert.rejects(
        service.createGroup(groupData),
        error => error.code === "ROOM_NOT_FOUND" && error.status === 404
    );
});

test("не дозволяє призначити базове приміщення іншій групі", async () => {
    const { service } = loadService({
        assignedGroup: { id: 2 }
    });

    await assert.rejects(
        service.createGroup(groupData),
        error =>
            error.code === "ROOM_ALREADY_ASSIGNED" &&
            error.status === 409
    );
});