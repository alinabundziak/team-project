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
    return proxyquire(
        "../src/modules/payroll/expenseSettings.controller.js",
        { "./expenseSettings.service": service }
    );
}

test("повертає параметри витрат зі статусом 200", async () => {
    const settings = { teacherMonthlySalary: 40000 };
    const controller = loadController({
        getExpenseSettings: async () => settings
    });
    const res = createResponse();

    await controller.getSettings({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: settings });
});

test("оновлює параметри витрат зі статусом 200", async () => {
    const settings = { teacherMonthlySalary: 45000 };
    const controller = loadController({
        updateExpenseSettings: async () => settings
    });
    const res = createResponse();

    await controller.updateSettings(
        { body: { teacherMonthlySalary: 45000 } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: settings });
});

test("відхиляє некоректний запит до виклику сервісу", async () => {
    let serviceCalled = false;

    const controller = loadController({
        updateExpenseSettings: async () => {
            serviceCalled = true;
            throw new Error("Сервіс не мав викликатися");
        }
    });
    const res = createResponse();

    await controller.updateSettings({ body: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.error.message,
        "Передано порожні або невідомі параметри"
    );
    assert.equal(serviceCalled, false);
});