const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;
function normalizedFilename(parent) {
    return (parent?.filename || "").replace(/\\/g, "/");
}

Module._load = function (request, parent, isMain) {
    const filename = normalizedFilename(parent);

    if (
        request === "../../config/prisma" &&
        filename.endsWith("/src/modules/payroll/payroll.service.js")
    ) {
        return {};
    }

    return originalLoad.call(this, request, parent, isMain);
};

const payrollService = require("../src/modules/payroll/payroll.service.js");
Module._load = originalLoad;

test("кошторис рахує зарплати за формулою незалежно від призначень", () => {
    const result = payrollService.calculateKindergartenSalaryEstimate([
        {
            id: 1,
            name: "Група 1",
            children: Array.from({ length: 15 }, (_, index) => ({ id: index + 1 }))
        },
        {
            id: 2,
            name: "Група 2",
            children: Array.from({ length: 10 }, (_, index) => ({ id: index + 101 }))
        }
    ], 2);

    assert.equal(result.groups[0].educatorMonthlySalary, 31500);
    assert.equal(result.groups[0].assistantMonthlySalary, 20000);
    assert.equal(result.groups[0].totalMonthlySalary, 51500);
    assert.equal(result.groups[1].educatorMonthlySalary, 20000);
    assert.equal(result.groups[1].assistantMonthlySalary, 20000);
    assert.equal(result.groupsMonthlySalary, 91500);
    assert.equal(result.teachersMonthlySalary, 80000);
    assert.equal(result.managerMonthlySalary, 80000);
    assert.equal(result.totalMonthlySalary, 251500);
});

test("кошторис для групи без призначених працівників все одно включає обидві ставки", () => {
    const result = payrollService.calculateKindergartenSalaryEstimate([
        {
            id: 1,
            name: "Група без призначень",
            children: [{ id: 1 }, { id: 2 }]
        }
    ], 0);

    assert.equal(result.groups[0].educatorMonthlySalary, 4000);
    assert.equal(result.groups[0].assistantMonthlySalary, 20000);
    assert.equal(result.totalMonthlySalary, 104000);
});


test("кошторис додає оренду за кількістю груп, а не кімнат у базі", async () => {
    const groups = [
        {
            id: 1,
            name: "Група 1",
            room: { id: 10, name: "Кімната 10" },
            children: Array.from({ length: 15 }, (_, index) => ({ id: index + 1 })),
            employees_educator: null,
            employees_assistant: null
        },
        {
            id: 2,
            name: "Група 2",
            room: { id: 11, name: "Кімната 11" },
            children: Array.from({ length: 10 }, (_, index) => ({ id: index + 101 })),
            employees_educator: null,
            employees_assistant: null
        }
    ];

    const Module = require("node:module");
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        const filename = (parent?.filename || "").replace(/\\/g, "/");
        const isStaffService = filename.endsWith(
            "/src/modules/employees/staff.service.js"
        );

        if (request === "../../config/prisma" && isStaffService) {
            return {
                groups: {
                    findMany: async () => groups
                }
            };
        }

        if (request === "../payroll/payroll.service" && isStaffService) {
            return {
                getKindergartenSalaryEstimate: async groupList =>
                    payrollService.calculateKindergartenSalaryEstimate(groupList, 2)
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    let staffService;
    try {
        delete require.cache[require.resolve("../src/modules/employees/staff.service.js")];
        staffService = require("../src/modules/employees/staff.service.js");
    } finally {
        Module._load = originalLoad;
    }

    const result = await staffService.getSalaryEstimates();

    assert.equal(result.totalMonthlyPersonnelExpenses, 251500);
    assert.equal(result.rent.roomCount, 2);
    assert.equal(result.rent.totalMonthlyRent, 100000);
    assert.equal(result.totalMonthlyExpenses, 351500);
    assert.equal(result.groups[0].educator.monthlySalary, 31500);
    assert.equal(result.groups[0].assistant.monthlySalary, 20000);
});
