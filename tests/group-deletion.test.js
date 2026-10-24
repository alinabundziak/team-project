const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadService({
    group = { id: 1 },
    childrenCount = 0,
    assignmentCount = 0,
    schedulesCount = 0
} = {}) {
    let wasDeleted = false;

    const service = proxyquire("../src/modules/groups/groups.service.js", {
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
    });

    return { service, wasDeleted: () => wasDeleted };
}

test("видаляє групу без пов'язаних записів", async () => {
    const { service, wasDeleted } = loadService();

    await service.deleteGroup(1);

    assert.equal(wasDeleted(), true);
});

test("повертає 404, якщо групи не існує", async () => {
    const { service, wasDeleted } = loadService({ group: null });

    await assert.rejects(
        service.deleteGroup(1),
        error => error.code === "GROUP_NOT_FOUND" && error.status === 404
    );

    assert.equal(wasDeleted(), false);
});

for (const [label, countKey] of [
    ["дітьми", "childrenCount"],
    ["призначеними працівниками", "assignmentCount"],
    ["записами розкладу", "schedulesCount"]
]) {
    test(`не видаляє групу з пов'язаними ${label}`, async () => {
        const { service, wasDeleted } = loadService({
            [countKey]: 1
        });

        await assert.rejects(
            service.deleteGroup(1),
            error => error.code === "GROUP_IN_USE" && error.status === 409
        );

        assert.equal(wasDeleted(), false);
    });
}