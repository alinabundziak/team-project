
const test = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire");

test("правильно розраховує зарплату вихователя", () => {
    const service = proxyquire("../src/modules/payroll/payroll.service", {
        "../../config/prisma": {}
    });

    assert.equal(service.calculateEducatorSalary(10), 20000);
    assert.equal(service.calculateEducatorSalary(12), 24000);
    assert.equal(service.calculateEducatorSalary(15), 31500);
});

test("правильно розраховує фіксовані зарплати", () => {
    const service = proxyquire("../src/modules/payroll/payroll.service", {
        "../../config/prisma": {}
    });

    assert.equal(service.calculateSalary("ASSISTANT"), 20000);
    assert.equal(service.calculateSalary("TEACHER"), 40000);
    assert.equal(service.calculateSalary("MANAGER"), 80000);
});


test("розраховує загальні витрати на персонал та оренду", async () => {
    const groups = [
        {
            id: 1,
            name: "Перша група",
            room: { id: 1, name: "Кімната 1" },
            children: [{ id: 1 }, { id: 2 }],
            employees_educator: {
                id: 1,
                first_name: "Олена",
                last_name: "Іваненко"
            },
            employees_assistant: {
                id: 2,
                first_name: "Ірина",
                last_name: "Петренко"
            }
        },
        {
            id: 2,
            name: "Друга група",
            room: { id: 2, name: "Кімната 2" },
            children: [{ id: 3 }],
            employees_educator: null,
            employees_assistant: null
        }
    ];

    const prismaMock = {
        groups: {
            findMany: async () => groups
        },
        rooms: {
            count: async () => 3
        }
    };

   const payrollMock = {
    calculateSalary: (position, count = 0) => {
        if (position === "EDUCATOR") {
            return 2000 * count + 500 * Math.max(0, count - 12);
        }
        if (position === "ASSISTANT") return 20000;
        if (position === "TEACHER") return 40000;
        if (position === "MANAGER") return 80000;
        throw new Error("Невідома посада");
    },

    getKindergartenSalaryEstimate: async (groups) => {
        const groupEstimates = groups.map(group => {
            const childrenCount = group.children.length;
            const educatorMonthlySalary =
                2000 * childrenCount +
                500 * Math.max(0, childrenCount - 12);

            return {
                groupId: group.id,
                educatorMonthlySalary,
                assistantMonthlySalary: 20000,
                totalMonthlySalary: educatorMonthlySalary + 20000
            };
        });

        const groupsMonthlySalary = groupEstimates.reduce(
            (sum, group) => sum + group.totalMonthlySalary,
            0
        );

        return {
            groups: groupEstimates,
            groupsMonthlySalary,
            teachersCount: 0,
            teachersMonthlySalary: 0,
            managerCount: 1,
            managerMonthlySalary: 80000,
            totalMonthlySalary: groupsMonthlySalary + 80000
        };
    }
};

    const service = proxyquire("../src/modules/employees/staff.service", {
        "../../config/prisma": prismaMock,
        "../payroll/payroll.service": payrollMock
    });

    const result = await service.getSalaryEstimates();

    assert.equal(result.groups.length, 2);
    assert.equal(result.rent.monthlyCostPerRoom, 50000);
    assert.equal(result.totalMonthlyPersonnelExpenses, 126000);
    assert.equal(result.rent.totalMonthlyRent, 100000);
    assert.equal(result.totalMonthlyExpenses, 226000);
});
