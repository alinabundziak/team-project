const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function makeAgeFourBirthDate() {
    const today = new Date();
    return new Date(Date.UTC(
        today.getUTCFullYear() - 4,
        today.getUTCMonth(),
        today.getUTCDate()
    ));
}

function loadService({ group, child, childrenCount = 0 } = {}) {
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

    const service = proxyquire("../src/modules/groups/groups.service.js", {
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
    });

    return {
        service,
        getUpdatedGroupId: () => updatedGroupId
    };
}

test("призначає дитину до відповідної групи", async () => {
    const { service, getUpdatedGroupId } = loadService();

    const result = await service.addChildToGroup(1, 10);

    assert.equal(result.groupId, 1);
    assert.equal(getUpdatedGroupId(), 1);
});

test("відхиляє призначення до групи іншого віку", async () => {
    const { service } = loadService({
        group: { id: 1, target_age: 3, capacity: 20 }
    });

    await assert.rejects(
        service.addChildToGroup(1, 10),
        error => error.code === "CHILD_AGE_MISMATCH" && error.status === 409
    );
});

test("відхиляє призначення, якщо група заповнена", async () => {
    const { service } = loadService({ childrenCount: 20 });

    await assert.rejects(
        service.addChildToGroup(1, 10),
        error => error.code === "GROUP_FULL" && error.status === 409
    );
});

test("відхиляє повторне призначення до тієї самої групи", async () => {
    const { service } = loadService({
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
        error => error.code === "CHILD_ALREADY_IN_GROUP" && error.status === 409
    );
});