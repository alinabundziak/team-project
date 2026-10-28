const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadService(groupCapacity, childrenCount, roomCapacity = 20) {
    const prisma = {
        groups: {
            findUnique: async () => ({
                id: 1,
                capacity: groupCapacity,
                room: {
                    capacity: roomCapacity
                }
            })
        },
        children: {
            count: async () => childrenCount
        }
    };

    return proxyquire("../src/modules/groups/groupCapacity.service.js", {
        "../../config/prisma": prisma
    });
}

function loadGroupAssignmentService({
    group,
    child,
    childrenCount = 0
} = {}) {
    const testGroup = {
        id: 1,
        target_age: 4,
        capacity: 20,
        room: { capacity: 20 },
        ...group
    };

    const testChild = child ?? {
        id: 10,
        first_name: "Олена",
        last_name: "Тест",
        birth_date: makeAgeFourBirthDate(),
        group_id: null
    };

    let updatedGroupId;

    const service = proxyquire(
        "../src/modules/groups/groups.service.js",
        {
            "../../config/prisma": {
                groups: {
                    findUnique: async () => testGroup
                },
                children: {
                    findUnique: async () => testChild,
                    count: async () => childrenCount,
                    update: async ({ data }) => {
                        updatedGroupId = data.group_id;
                        return { ...testChild, ...data };
                    }
                }
            }
        }
    );

    return {
        service,
        getUpdatedGroupId: () => updatedGroupId
    };
}

function loadGroupDeletionService({
    group = { id: 1 },
    childrenCount = 0,
    assignmentCount = 0,
    schedulesCount = 0
} = {}) {
    let wasDeleted = false;

    const service = proxyquire(
        "../src/modules/groups/groups.service.js",
        {
            "../../config/prisma": {
                groups: {
                    findUnique: async () => group,
                    delete: async ({ where }) => {
                        wasDeleted = true;
                        return { id: where.id };
                    }
                },
                children: {
                    count: async () => childrenCount
                },
                staff_assignments: {
                    count: async () => assignmentCount
                },
                schedules: {
                    count: async () => schedulesCount
                }
            }
        }
    );

    return { service, wasDeleted: () => wasDeleted };
}

test("видаляє групу без пов'язаних записів", async () => {
    const { service, wasDeleted } = loadGroupDeletionService();

    await service.deleteGroup(1);

    assert.equal(wasDeleted(), true);
});

test("повертає 404, якщо групи не існує", async () => {
    const { service, wasDeleted } =
        loadGroupDeletionService({ group: null });

    await assert.rejects(
        service.deleteGroup(1),
        error =>
            error.code === "GROUP_NOT_FOUND" &&
            error.status === 404
    );

    assert.equal(wasDeleted(), false);
});

for (const [label, countKey] of [
    ["дітьми", "childrenCount"],
    ["призначеними працівниками", "assignmentCount"],
    ["записами розкладу", "schedulesCount"]
]) {
    test(`не видаляє групу з пов'язаними ${label}`, async () => {
        const { service, wasDeleted } =
            loadGroupDeletionService({ [countKey]: 1 });

        await assert.rejects(
            service.deleteGroup(1),
            error =>
                error.code === "GROUP_IN_USE" &&
                error.status === 409
        );

        assert.equal(wasDeleted(), false);
    });
}

test("дозволяє додати дитину, якщо є вільне місце", async () => {
    const service = loadService(20, 19);

    await assert.doesNotReject(
        service.assertGroupHasCapacity(1)
    );
});

test("відхиляє додавання, коли в групі вже 20 дітей", async () => {
    const service = loadService(20, 20);

    await assert.rejects(
        service.assertGroupHasCapacity(1),
        error => error.status === 409
    );
});

test("не дозволяє перевищити 20, навіть якщо місткість групи більша", async () => {
    const service = loadService(25, 20);

    await assert.rejects(
        service.assertGroupHasCapacity(1),
        error => error.status === 409
    );
});

test("відхиляє додавання, якщо вичерпана місткість кімнати", async () => {
    const service = loadService(20, 15, 15);

    await assert.rejects(
        service.assertGroupHasCapacity(1),
        error => error.status === 409
    );
});

test("перевіряє місткість при створенні та перепризначенні дитини", async () => {
    const capacityCalls = [];

    const child = {
        id: 7,
        first_name: "Олена",
        last_name: "Тест",
        birth_date: new Date("2022-01-01"),
        group_id: null,
        parent_id: null
    };

    const service = proxyquire(
        "../src/modules/children/children.service.js",
        {
            "./children.repository": {
                findGroupById: async id => ({ id, capacity: 20, target_age: 4 }),
                create: async data => ({ id: 8, ...data, parent_id: null }),
                findById: async id => ({
                    ...child,
                    id,
                    group_id: id === 9 ? 1 : null
                }),
                update: async (id, data) => ({ ...child, id, ...data })
            },
            "../../utils/AppError": class AppError extends Error {
                constructor(status, message) {
                    super(message);
                    this.status = status;
                }
            },
            "../../utils/parseId": raw => Number(raw),
            "../../utils/age": {
                parseDateOnly: value => new Date(value),
                todayUtc: () => new Date("2026-01-01"),
                calculateAge: date => date.getUTCFullYear() === 2021 ? 5 : 4,
                formatDateOnly: () => "2022-01-01"
            },
            "../../config/childrenRules": {
                MIN_AGE_YEARS: 2,
                MAX_AGE_YEARS: 5,
                MAX_NAME_LENGTH: 100
            },
            "../../utils/validators": {
                validateName: value => value
            },
            "../../utils/pagination": {
                parsePagination: () => ({ page: 1, limit: 20 })
            },
            "./children.access": {
                assertChildAccess: async () => child,
                getOwnParentId: async () => null
            },
            "../groups/groupCapacity.service": {
                assertGroupHasCapacity: async (...args) => {
                    capacityCalls.push(args);
                }
            }
        }
    );

    await service.createChild({
        firstName: "Олена",
        lastName: "Тест",
        dateOfBirth: "2022-01-01",
        groupId: 1
    });

    await service.updateChild(7, { groupId: 2 });

    assert.deepEqual(capacityCalls, [[1], [2, 7]]);

    await assert.rejects(
        service.createChild({
            firstName: "Олена",
            lastName: "Тест",
            dateOfBirth: "2021-01-01",
            groupId: 1
        }),
        error => error.status === 409
    );

    await assert.rejects(
        service.updateChild(9, {
            dateOfBirth: "2021-01-01"
        }),
        error => error.status === 409
    );
});

function makeAgeFourBirthDate() {
    const today = new Date();

    return new Date(Date.UTC(
        today.getUTCFullYear() - 4,
        today.getUTCMonth(),
        today.getUTCDate()
    ));
}

test("призначає дитину до відповідної групи", async () => {
    const { service, getUpdatedGroupId } =
        loadGroupAssignmentService();

    const result = await service.addChildToGroup(1, 10);

    assert.equal(result.groupId, 1);
    assert.equal(getUpdatedGroupId(), 1);
});

test("відхиляє призначення до групи іншого віку", async () => {
    const { service } = loadGroupAssignmentService({
        group: { id: 1, target_age: 3, capacity: 20 }
    });

    await assert.rejects(
        service.addChildToGroup(1, 10),
        error =>
            error.code === "CHILD_AGE_MISMATCH" &&
            error.status === 409
    );
});

test("відхиляє призначення, якщо група заповнена", async () => {
    const { service } = loadGroupAssignmentService({
        childrenCount: 20
    });

    await assert.rejects(
        service.addChildToGroup(1, 10),
        error =>
            error.code === "GROUP_FULL" &&
            error.status === 409
    );
});

test("відхиляє повторне призначення до тієї самої групи", async () => {
    const { service } = loadGroupAssignmentService({
        child: {
            id: 10,
            first_name: "Олена",
            last_name: "Тест",
            birth_date: makeAgeFourBirthDate(),
            group_id: 1
        }
    });

    await assert.rejects(
        service.addChildToGroup(1, 10),
        error =>
            error.code === "CHILD_ALREADY_IN_GROUP" &&
            error.status === 409
    );
});

function loadGroupRoomController() {
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

function makeGroupRoomResponse() {
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
    const { controller, calls } = loadGroupRoomController();
    const res = makeGroupRoomResponse();

    await controller.createGroup(
        { body: { name: "Молодша", ageYears: 3 } },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});

test("приймає ID базового приміщення під час створення групи", async () => {
    const { controller, calls } = loadGroupRoomController();
    const res = makeGroupRoomResponse();

    await controller.createGroup(
        {
            body: {
                name: "Молодша",
                ageYears: 3,
                roomId: 5
            }
        },
        res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(calls[0].roomId, 5);
});

test("не дозволяє прибрати базове приміщення під час оновлення групи", async () => {
    const { controller, calls } = loadGroupRoomController();
    const res = makeGroupRoomResponse();

    await controller.updateGroup(
        { params: { id: "1" }, body: { roomId: null } },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});

function loadGroupRoomService({
    room,
    assignedGroup = null
} = {}) {
    const testRoom = room === undefined
        ? { id: 5, name: "Кімната 5", capacity: 20, description: null }
        : room;

    let createdData;

    const service = proxyquire(
        "../src/modules/groups/groups.service.js",
        {
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
                            staff_assignments: [],
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
        }
    );

    return {
        service,
        getCreatedData: () => createdData
    };
}

const groupRoomData = {
    name: "Молодша",
    ageYears: 3,
    roomId: 5
};

test("створює групу з наявним базовим приміщенням", async () => {
    const { service, getCreatedData } = loadGroupRoomService();

    const group = await service.createGroup(groupRoomData);

    assert.equal(group.roomId, 5);
    assert.equal(getCreatedData().room_id, 5);
});

test("не створює групу з неіснуючим приміщенням", async () => {
    const { service } = loadGroupRoomService({ room: null });

    await assert.rejects(
        service.createGroup(groupRoomData),
        error =>
            error.code === "ROOM_NOT_FOUND" &&
            error.status === 404
    );
});

test("не дозволяє призначити базове приміщення іншій групі", async () => {
    const { service } = loadGroupRoomService({
        assignedGroup: { id: 2 }
    });

    await assert.rejects(
        service.createGroup(groupRoomData),
        error =>
            error.code === "ROOM_ALREADY_ASSIGNED" &&
            error.status === 409
    );
});

function loadGroupStaffService(position, assignedElsewhere = null) {
    const prisma = {
        groups: {
            findUnique: async () => ({ id: 1 }),
            findFirst: async () => assignedElsewhere
        },
        employees: {
            findUnique: async () => ({ id: 7, position })
        },
        staff_assignments: {
            findUnique: async () => null,
            create: async ({ data }) => ({
                ...data,
                created_at: new Date("2026-01-01T00:00:00.000Z")
            })
        }
    };

    return proxyquire(
        "../src/modules/groups/groups.service.js",
        { "../../config/prisma": prisma }
    );
}

test("дозволяє призначити вихователя до групи", async () => {
    const service = loadGroupStaffService("EDUCATOR");

    const result = await service.assignStaffToGroup(1, 7);

    assert.equal(result.staffId, 7);
    assert.equal(result.groupId, 1);
});

test("відхиляє призначення вчителя до групи", async () => {
    const service = loadGroupStaffService("TEACHER");

    await assert.rejects(
        service.assignStaffToGroup(1, 7),
        error =>
            error.code === "STAFF_POSITION_NOT_ALLOWED" &&
            error.status === 409
    );
});

test("відхиляє працівника, вже пов'язаного з іншою групою", async () => {
    const service = loadGroupStaffService("EDUCATOR", { id: 2 });

    await assert.rejects(
        service.assignStaffToGroup(1, 7),
        error =>
            error.code === "STAFF_ASSIGNED_TO_ANOTHER_GROUP" &&
            error.status === 409
    );
});

test("дозволяє призначити помічника до групи", async () => {
    const service = loadGroupStaffService("ASSISTANT");

    const result = await service.assignStaffToGroup(1, 7);

    assert.equal(result.staffId, 7);
    assert.equal(result.groupId, 1);
});

function createGroupsValidationResponse() {
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

function loadGroupsValidationController(service) {
    return proxyquire(
        "../src/modules/groups/groups.controller.js",
        { "./groups.service": service }
    );
}

test("відхиляє некоректну групу до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadGroupsValidationController({
        createGroup: async () => {
            serviceCalled = true;
        }
    });
    const res = createGroupsValidationResponse();

    await controller.createGroup(
        {
            body: {
                name: " ",
                ageYears: 3,
                capacity: 20,
                roomId: 1
            }
        },
        res
    );

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
    const controller = loadGroupsValidationController({
        getGroupById: async () => {
            serviceCalled = true;
        }
    });
    const res = createGroupsValidationResponse();

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
    const controller = loadGroupsValidationController({
        addChildToGroup: async () => {
            serviceCalled = true;
        }
    });
    const res = createGroupsValidationResponse();

    await controller.addChildToGroup(
        {
            params: { id: "1" },
            body: { childId: "7" }
        },
        res
    );

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
    const controller = loadGroupsValidationController({
        addChildToGroup: async (groupId, childId) => {
            receivedIds = { groupId, childId };
            return { id: childId };
        }
    });
    const res = createGroupsValidationResponse();

    await controller.addChildToGroup(
        {
            params: { id: "1" },
            body: { childId: 7 }
        },
        res
    );

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { data: { id: 7 } });
    assert.deepEqual(receivedIds, { groupId: 1, childId: 7 });
});

test("повертає скасування призначення працівника у полі data", async () => {
    const controller = loadGroupsValidationController({
        removeStaffFromGroup: async () => {}
    });
    const res = createGroupsValidationResponse();

    await controller.removeStaffFromGroup(
        { params: { id: "1", staffId: "7" } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        data: {
            message: "Призначення працівника скасовано"
        }
    });
});