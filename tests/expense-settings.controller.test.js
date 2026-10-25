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
    assert.deepEqual(res.body, settings);
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
    assert.deepEqual(res.body, settings);
});

test("повертає помилку валідації зі статусом 400", async () => {
    const controller = loadController({
        updateExpenseSettings: async () => {
            const error = new Error("Некоректне значення");
            error.status = 400;
            throw error;
        }
    });
    const res = createResponse();

    await controller.updateSettings({ body: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.message, "Некоректне значення");
});