const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function createService() {
    const createdRules = [];

    const prisma = {
        rules: {
            findMany: async () => [],
            findFirst: async () => null,
            create: async ({ data }) => {
                createdRules.push(data);
                return data;
            },
            update: async ({ data }) => data
        },
        $transaction: async operations => Promise.all(operations)
    };

    const service = proxyquire(
        "../src/modules/payroll/expenseSettings.service.js",
        { "../../config/prisma": prisma }
    );

    return { service, createdRules };
}

test("повертає початкові параметри витрат, якщо налаштувань ще немає", async () => {
    const { service } = createService();

    const settings = await service.getExpenseSettings();

    assert.equal(settings.extraChildrenThreshold, 12);
    assert.equal(settings.educatorBasePerChild, 2000);
    assert.equal(settings.educatorExtraPerChild, 5000);
    assert.equal(settings.assistantBaseMonthlySalary, 20000);
    assert.equal(settings.assistantExtraPerChild, 3000);
    assert.equal(settings.teacherMonthlySalary, 40000);
    assert.equal(settings.managerMonthlySalary, 80000);
    assert.equal(settings.rentPerGroup, 50000);
});

test("оновлює параметри й створює відповідні правила", async () => {
    const { service, createdRules } = createService();

    const settings = await service.updateExpenseSettings({
        extraChildrenThreshold: 15,
        assistantExtraPerChild: 3500,
        managerMonthlySalary: 85000
    });

    assert.equal(settings.extraChildrenThreshold, 15);
    assert.equal(settings.assistantExtraPerChild, 3500);
    assert.equal(settings.managerMonthlySalary, 85000);
    assert.equal(createdRules.length, 5);
});

test("відхиляє невідомий параметр", async () => {
    const { service } = createService();

    await assert.rejects(
        service.updateExpenseSettings({ unknownSetting: 123 }),
        error => error.status === 400
    );
});