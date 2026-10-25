const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function createResponse() {
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

function loadController(service) {
    return proxyquire("../src/modules/employees/staff.controller.js", {
        "./staff.service": service
    });
}

test("відхиляє працівника без обов'язкового імені до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        createStaff: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.createStaff({
        user: { role: "ADMIN" },
        body: {
            firstName: " ",
            lastName: "Тест",
            position: "EDUCATOR"
        }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "Ім'я працівника обов'язкове"
        }
    });
    assert.equal(serviceCalled, false);
});

test("відхиляє від'ємну зарплату до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        createStaff: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.createStaff({
        user: { role: "ADMIN" },
        body: {
            firstName: "Олена",
            lastName: "Тест",
            position: "EDUCATOR",
            monthlySalary: -1
        }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(serviceCalled, false);
    assert.match(res.body.error.message, /Місячна зарплата/);
});

test("відхиляє некоректний ID працівника до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadController({
        getStaffById: async () => {
            serviceCalled = true;
        }
    });
    const res = createResponse();

    await controller.getStaffById({
        params: { id: "abc" },
        user: { role: "ADMIN" }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: {
            status: 400,
            message: "ID працівника повинен бути додатним цілим числом"
        }
    });
    assert.equal(serviceCalled, false);
});

test("повертає список працівників у полі data", async () => {
    const staff = [{ id: 5, firstName: "Олена" }];
    const controller = loadController({
        getStaff: async () => staff
    });
    const res = createResponse();

    await controller.getStaff({
        user: { role: "ADMIN" }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: staff });
});

test("повертає кошторис зарплат у полі data", async () => {
    const estimates = { totalMonthlySalary: 100000 };
    const controller = loadController({
        getSalaryEstimates: async () => estimates
    });
    const res = createResponse();

    await controller.getSalaryEstimates({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: estimates });
});