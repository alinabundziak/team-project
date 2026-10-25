const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

test("кошторис використовує змінені параметри витрат", async () => {
    const settings = {
        extraChildrenThreshold: 10,
        educatorBasePerChild: 1000,
        educatorExtraPerChild: 500,
        assistantBaseMonthlySalary: 12000,
        assistantExtraPerChild: 300,
        teacherMonthlySalary: 45000,
        managerMonthlySalary: 90000,
        rentPerGroup: 60000
    };

    const prisma = {
        employees: {
            count: async () => 2
        }
    };

    const payrollService = proxyquire(
        "../src/modules/payroll/payroll.service.js",
        {
            "../../config/prisma": prisma,
            "./expenseSettings.service": {
                getExpenseSettings: async () => settings
            }
        }
    );

    const groups = [{
        id: 1,
        name: "Тестова група",
        children: Array.from({ length: 13 }, (_, index) => ({
            id: index + 1
        }))
    }];

    const result =
        await payrollService.getKindergartenSalaryEstimate(groups);

    assert.equal(result.groups[0].educatorMonthlySalary, 14500);
    assert.equal(result.groups[0].assistantMonthlySalary, 12900);
    assert.equal(result.teachersMonthlySalary, 90000);
    assert.equal(result.managerMonthlySalary, 90000);
    assert.equal(result.totalMonthlySalary, 207400);
    assert.equal(result.monthlySalaryPerTeacher, 45000);
    assert.equal(result.rentPerGroup, 60000);
});