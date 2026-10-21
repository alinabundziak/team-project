
const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

let serviceResult;
let serviceError;

const controller = proxyquire(
    "../src/modules/employees/staff.controller.js",
    {
        "./staff.service": {
            getStaffDistributionAnalysis: async () => {
                if (serviceError) {
                    throw serviceError;
                }

                return serviceResult;
            }
        },
        "../../config/roles": {
            ROLES: {
                ADMIN: "ADMIN",
                MANAGER: "MANAGER"
            }
        }
    }
);

function makeResponse() {
    return {
        statusCode: null,
        body: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(data) {
            this.body = data;
            return this;
        }
    };
}

test("повертає 200 і результат аналізу", async () => {
    serviceError = null;
    serviceResult = {
        summary: {
            groupsCount: 2,
            groupsWithShortage: 1,
            groupsWithSurplus: 0,
            employeesCount: 4,
            unassignedEmployeesCount: 1
        },
        groups: [],
        unassignedEmployees: []
    };

    const req = {};
    const res = makeResponse();

    await controller.getStaffDistributionAnalysis(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, serviceResult);
});

test("повертає статус помилки сервісу", async () => {
    serviceResult = null;
    serviceError = Object.assign(
        new Error("Тестова помилка"),
        { status: 503 }
    );

    const req = {};
    const res = makeResponse();

    await controller.getStaffDistributionAnalysis(req, res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
        error: {
            status: 503,
            message: "Тестова помилка"
        }
    });

    serviceError = null;
});
