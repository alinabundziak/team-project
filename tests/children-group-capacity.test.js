const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

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