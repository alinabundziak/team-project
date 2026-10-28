const test = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire");
const Module = require("node:module");

test("правильно розраховує зарплату вихователя", () => {
    const service = proxyquire("../src/modules/payroll/payroll.service", {
        "../../config/prisma": {}
    });

    assert.equal(service.calculateEducatorSalary(10), 20000);
    assert.equal(service.calculateEducatorSalary(12), 24000);
    assert.equal(service.calculateEducatorSalary(15), 45000);
});

test("правильно розраховує фіксовані зарплати", () => {
    const service = proxyquire("../src/modules/payroll/payroll.service", {
        "../../config/prisma": {}
    });

    assert.equal(service.calculateSalary("ASSISTANT"), 20000);
    assert.equal(service.calculateSalary("TEACHER"), 40000);
    assert.equal(service.calculateSalary("MANAGER"), 80000);
    assert.equal(service.calculateSalary("ASSISTANT", 12), 20000);
    assert.equal(service.calculateSalary("ASSISTANT", 13), 23000);
    assert.equal(service.calculateSalary("ASSISTANT", 15), 29000);
});


test("розраховує загальні витрати на персонал та оренду", async () => {
    const groups = [
        {
            id: 1,
            name: "Перша група",
            room: { id: 1, name: "Кімната 1" },
            children: [{ id: 1 }, { id: 2 }],
            staff_assignments: [
                {
                    role: "EDUCATOR",
                    employee: {
                        id: 1,
                        first_name: "Олена",
                        last_name: "Іваненко"
                    }
                },
                {
                    role: "ASSISTANT",
                    employee: {
                        id: 2,
                        first_name: "Ірина",
                        last_name: "Петренко"
                    }
                }
            ]
        },
        {
            id: 2,
            name: "Друга група",
            room: { id: 2, name: "Кімната 2" },
            children: [{ id: 3 }],
            staff_assignments: []
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
            return 2000 * count + 5000 * Math.max(0, count - 12);
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
                5000 * Math.max(0, childrenCount - 12);

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

    assert.equal(result.groups[0].educatorMonthlySalary, 45000);
    assert.equal(result.groups[0].assistantMonthlySalary, 29000);
    assert.equal(result.groups[0].totalMonthlySalary, 74000);
    assert.equal(result.groups[1].educatorMonthlySalary, 20000);
    assert.equal(result.groups[1].assistantMonthlySalary, 20000);
    assert.equal(result.groupsMonthlySalary, 114000);
    assert.equal(result.totalMonthlySalary, 274000);
    assert.equal(result.managerMonthlySalary, 80000);
    assert.equal(result.totalMonthlySalary, 274000);
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
            staff_assignments: []
        },
        {
            id: 2,
            name: "Група 2",
            room: { id: 11, name: "Кімната 11" },
            children: Array.from({ length: 10 }, (_, index) => ({ id: index + 101 })),
            staff_assignments: []
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

    assert.equal(result.totalMonthlyPersonnelExpenses, 274000);
    assert.equal(result.rent.roomCount, 2);
    assert.equal(result.rent.totalMonthlyRent, 100000);
    assert.equal(result.totalMonthlyExpenses, 374000);
    assert.equal(result.groups[0].educator.monthlySalary, 45000);
    assert.equal(result.groups[0].assistant.monthlySalary, 29000);
});

function createExpenseSettingsTestService() {
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
    const { service } = createExpenseSettingsTestService();

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
    const { service, createdRules } =
        createExpenseSettingsTestService();

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
    const { service } = createExpenseSettingsTestService();

    await assert.rejects(
        service.updateExpenseSettings({ unknownSetting: 123 }),
        error => error.status === 400
    );
});

function createExpenseSettingsControllerResponse() {
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

function loadExpenseSettingsController(service) {
    return proxyquire(
        "../src/modules/payroll/expenseSettings.controller.js",
        { "./expenseSettings.service": service }
    );
}

test("повертає параметри витрат зі статусом 200", async () => {
    const settings = { teacherMonthlySalary: 40000 };
    const controller = loadExpenseSettingsController({
        getExpenseSettings: async () => settings
    });
    const res = createExpenseSettingsControllerResponse();

    await controller.getSettings({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: settings });
});

test("оновлює параметри витрат зі статусом 200", async () => {
    const settings = { teacherMonthlySalary: 45000 };
    const controller = loadExpenseSettingsController({
        updateExpenseSettings: async () => settings
    });
    const res = createExpenseSettingsControllerResponse();

    await controller.updateSettings(
        { body: { teacherMonthlySalary: 45000 } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: settings });
});

test("відхиляє некоректний запит до виклику сервісу", async () => {
    let serviceCalled = false;

    const controller = loadExpenseSettingsController({
        updateExpenseSettings: async () => {
            serviceCalled = true;
            throw new Error("Сервіс не мав викликатися");
        }
    });
    const res = createExpenseSettingsControllerResponse();

    await controller.updateSettings({ body: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(
        res.body.error.message,
        "Передано порожні або невідомі параметри"
    );
    assert.equal(serviceCalled, false);
});

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