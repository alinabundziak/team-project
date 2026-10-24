const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadService(position, assignedElsewhere = null) {
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
                assigned_at: new Date("2026-01-01T00:00:00.000Z")
            })
        }
    };

    return proxyquire("../src/modules/groups/groups.service.js", {
        "../../config/prisma": prisma
    });
}

test("дозволяє призначити вихователя до групи", async () => {
    const service = loadService("EDUCATOR");

    const result = await service.assignStaffToGroup(1, 7);

    assert.equal(result.staffId, 7);
    assert.equal(result.groupId, 1);
});

test("відхиляє призначення вчителя до групи", async () => {
    const service = loadService("TEACHER");

    await assert.rejects(
        service.assignStaffToGroup(1, 7),
        error =>
            error.code === "STAFF_POSITION_NOT_ALLOWED" &&
            error.status === 409
    );
});

test("відхиляє працівника, вже пов'язаного з іншою групою", async () => {
    const service = loadService("EDUCATOR", { id: 2 });

    await assert.rejects(
        service.assignStaffToGroup(1, 7),
        error =>
            error.code === "STAFF_ASSIGNED_TO_ANOTHER_GROUP" &&
            error.status === 409
    );
});

test("дозволяє призначити помічника до групи", async () => {
    const service = loadService("ASSISTANT");

    const result = await service.assignStaffToGroup(1, 7);

    assert.equal(result.staffId, 7);
    assert.equal(result.groupId, 1);
});