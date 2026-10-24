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