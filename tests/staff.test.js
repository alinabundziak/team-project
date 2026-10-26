const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

test("створює працівника з переданими даними", async () => {
    let savedData;

    const prisma = {
        employees: {
            create: async ({ data }) => {
                savedData = data;

                return {
                    id: 1,
                    user_id: null,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    phone: data.phone,
                    position: data.position,
                    subject: data.subject,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.createStaff({
        firstName: "Олена",
        lastName: "Тест",
        position: "EDUCATOR"
    });

    assert.deepEqual(savedData, {
        first_name: "Олена",
        last_name: "Тест",
        position: "EDUCATOR",
        phone: null,
        subject: null
    });
    assert.equal(result.id, 1);
    assert.equal(result.position, "EDUCATOR");
});

test("оновлює контактні дані працівника", async () => {
    let updatedData;

    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 1,
                position: "EDUCATOR"
            }),
            update: async ({ data }) => {
                updatedData = data;

                return {
                    id: 1,
                    user_id: null,
                    first_name: "Олена",
                    last_name: "Тест",
                    phone: data.phone,
                    position: "EDUCATOR",
                    subject: null,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.updateStaff(1, {
        phone: "+380501112233"
    });

    assert.deepEqual(updatedData, {
        phone: "+380501112233"
    });
    assert.equal(result.phone, "+380501112233");
});

test("не дозволяє видалити працівника з пов'язаною групою", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({ id: 1 }),
            delete: async () => {
                throw new Error("delete не повинен викликатися");
            }
        },
        groups: { count: async () => 1 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0, findMany: async () => [] },
        staff_assignments: { count: async () => 1 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.deleteStaff(1),
        error => error.code === "STAFF_IN_USE" && error.status === 409
    );
});

test("видаляє працівника без пов'язаних записів", async () => {
    let deleted = false;

    const prisma = {
        employees: {
            findUnique: async () => ({ id: 1 }),
            delete: async () => {
                deleted = true;
                return { id: 1 };
            }
        },
        groups: { count: async () => 0 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0, findMany: async () => [] },
        staff_assignments: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.deleteStaff(1);

    assert.equal(deleted, true);
    assert.deepEqual(result, { id: 1 });
});

test("повертає список працівників без зарплати", async () => {
    const prisma = {
        employees: {
            findMany: async () => [{
                id: 1,
                user_id: null,
                first_name: "Олена",
                last_name: "Тест",
                phone: null,
                position: "EDUCATOR",
                subject: null,
                salary: 40000
            }]
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.getStaff();

    assert.equal(result.length, 1);
    assert.equal(result[0].position, "EDUCATOR");
    assert.equal("monthlySalary" in result[0], false);
});

test("повертає 404 для неіснуючого працівника", async () => {
    const prisma = {
        employees: {
            findUnique: async () => null
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.getStaffById(999),
        error => error.code === "STAFF_NOT_FOUND" && error.status === 404
    );
});

test("створює працівника з посадою помічника", async () => {
    const prisma = {
        employees: {
            create: async ({ data }) => ({
                id: 2,
                user_id: null,
                first_name: data.first_name,
                last_name: data.last_name,
                phone: data.phone,
                position: data.position,
                subject: data.subject,
                salary: 20000
            })
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.createStaff({
        firstName: "Марія",
        lastName: "Помічник",
        position: "ASSISTANT"
    });

    assert.equal(result.position, "ASSISTANT");
});

test("створює викладача із зазначеною дисципліною", async () => {
    let savedData;

    const prisma = {
        employees: {
            create: async ({ data }) => {
                savedData = data;

                return {
                    id: 3,
                    user_id: null,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    phone: data.phone,
                    position: data.position,
                    subject: data.subject,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.createStaff({
        firstName: "Ірина",
        lastName: "Тест",
        position: "TEACHER",
        subject: "Музика"
    });

    assert.equal(savedData.position, "TEACHER");
    assert.equal(savedData.subject, "Музика");
    assert.equal(result.subject, "Музика");
});

test("оновлює дисципліну викладача", async () => {
    let updatedData;

    const prisma = {
        teacher_activities: {
            count: async () => 0,
            findMany: async () => []
        },
        employees: {
            findUnique: async () => ({
                id: 3,
                position: "TEACHER"
            }),
            update: async ({ data }) => {
                updatedData = data;

                return {
                    id: 3,
                    user_id: null,
                    first_name: "Ірина",
                    last_name: "Тест",
                    phone: null,
                    position: "TEACHER",
                    subject: data.subject,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.updateStaff(3, {
        subject: "Музика"
    });

    assert.deepEqual(updatedData, {
        subject: "Музика"
    });
    assert.equal(result.subject, "Музика");
});

test("не дозволяє змінити посаду працівника, призначеного до групи", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 5,
                position: "EDUCATOR"
            }),
            update: async ({ data }) => ({
                id: 5,
                user_id: null,
                first_name: "Олена",
                last_name: "Тест",
                phone: null,
                position: data.position,
                subject: null,
                salary: 40000
            })
        },
        groups: { count: async () => 1 },
        staff_assignments: { count: async () => 1 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.updateStaff(5, { position: "TEACHER" }),
        error =>
            error.code === "STAFF_POSITION_IN_USE" &&
            error.status === 409
    );
});

test("не дозволяє змінити посаду призначеного помічника", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 6,
                position: "ASSISTANT"
            }),
            update: async ({ data }) => ({
                id: 6,
                user_id: null,
                first_name: "Марія",
                last_name: "Тест",
                phone: null,
                position: data.position,
                subject: null,
                salary: 20000
            })
        },
        groups: { count: async () => 1 },
        staff_assignments: { count: async () => 1 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.updateStaff(6, { position: "EDUCATOR" }),
        error =>
            error.code === "STAFF_POSITION_IN_USE" &&
            error.status === 409
    );
});

test("не дозволяє змінити предмет викладача, призначеного до дисципліни", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 7,
                position: "TEACHER"
            }),
            update: async () => {
                throw new Error("Оновлення не мало виконатися");
            }
        },
        teacher_activities: {
            findMany: async () => [
                { activity: { name: "Музика" } }
            ],
            count: async () => 1
        },
        groups: { count: async () => 0 },
        staff_assignments: { count: async () => 1 },
        schedules: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.updateStaff(7, { subject: "Математика" }),
        (error) =>
            error.code === "STAFF_SUBJECT_IN_USE" &&
            error.status === 409
    );
});

function createStaffValidationResponse() {
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

function loadStaffValidationController(service) {
    return proxyquire(
        "../src/modules/employees/staff.controller.js",
        { "./staff.service": service }
    );
}

test("відхиляє працівника без обов'язкового імені до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadStaffValidationController({
        createStaff: async () => {
            serviceCalled = true;
        }
    });
    const res = createStaffValidationResponse();

    await controller.createStaff(
        {
            user: { role: "ADMIN" },
            body: {
                firstName: " ",
                lastName: "Тест",
                position: "EDUCATOR"
            }
        },
        res
    );

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
    const controller = loadStaffValidationController({
        createStaff: async () => {
            serviceCalled = true;
        }
    });
    const res = createStaffValidationResponse();

    await controller.createStaff(
        {
            user: { role: "ADMIN" },
            body: {
                firstName: "Олена",
                lastName: "Тест",
                position: "EDUCATOR",
                monthlySalary: -1
            }
        },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(serviceCalled, false);
    assert.match(res.body.error.message, /Місячна зарплата/);
});

test("відхиляє некоректний ID працівника до виклику сервісу", async () => {
    let serviceCalled = false;
    const controller = loadStaffValidationController({
        getStaffById: async () => {
            serviceCalled = true;
        }
    });
    const res = createStaffValidationResponse();

    await controller.getStaffById(
        {
            params: { id: "abc" },
            user: { role: "ADMIN" }
        },
        res
    );

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
    const controller = loadStaffValidationController({
        getStaff: async () => staff
    });
    const res = createStaffValidationResponse();

    await controller.getStaff(
        { user: { role: "ADMIN" } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: staff });
});

test("повертає кошторис зарплат у полі data", async () => {
    const estimates = { totalMonthlySalary: 100000 };
    const controller = loadStaffValidationController({
        getSalaryEstimates: async () => estimates
    });
    const res = createStaffValidationResponse();

    await controller.getSalaryEstimates({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: estimates });
});

let staffDistributionServiceResult;
let staffDistributionServiceError;

const staffDistributionController = proxyquire(
    "../src/modules/employees/staff.controller.js",
    {
        "./staff.service": {
            getStaffDistributionAnalysis: async () => {
                if (staffDistributionServiceError) {
                    throw staffDistributionServiceError;
                }

                return staffDistributionServiceResult;
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

function makeStaffDistributionResponse() {
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
    staffDistributionServiceError = null;
    staffDistributionServiceResult = {
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

    const res = makeStaffDistributionResponse();

    await staffDistributionController.getStaffDistributionAnalysis({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        data: staffDistributionServiceResult
    });
});

test("повертає статус помилки сервісу", async () => {
    staffDistributionServiceResult = null;
    staffDistributionServiceError = Object.assign(
        new Error("Тестова помилка"),
        { status: 503 }
    );

    const res = makeStaffDistributionResponse();

    await staffDistributionController.getStaffDistributionAnalysis({}, res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
        error: {
            status: 503,
            message: "Тестова помилка"
        }
    });

    staffDistributionServiceError = null;
});

const registeredStaffRoutes = [];
const staffRouteMiddleware = [];

const mockStaffController = {
    getStaff: () => {},
    getStaffById: () => {},
    createStaff: () => {},
    updateStaff: () => {},
    deleteStaff: () => {},
    getSalaryEstimates: () => {},
    getStaffDistributionAnalysis: () => {}
};

const staffRouterMock = {
    use(...middleware) {
        staffRouteMiddleware.push(...middleware);
    },
    get(path, handler) {
        registeredStaffRoutes.push({ method: "GET", path, handler });
    },
    post(path, handler) {
        registeredStaffRoutes.push({ method: "POST", path, handler });
    },
    patch(path, handler) {
        registeredStaffRoutes.push({ method: "PATCH", path, handler });
    },
    delete(path, handler) {
        registeredStaffRoutes.push({ method: "DELETE", path, handler });
    }
};

const staffAuthenticate = () => {};
const staffAuthorizeRoles = (...roles) => {
    staffAuthorizeRoles.receivedRoles = roles;
    return () => {};
};

proxyquire("../src/modules/employees/staff.routes.js", {
    express: { Router: () => staffRouterMock },
    "./staff.controller": mockStaffController,
    "../../middleware/authenticate": staffAuthenticate,
    "../../middleware/authorizeRoles": staffAuthorizeRoles,
    "../../config/roles": {
        ROLES: {
            ADMIN: "ADMIN",
            MANAGER: "MANAGER"
        }
    }
});

test("маршрут аналізу зареєстрований перед маршрутом з ID", () => {
    const analysisIndex = registeredStaffRoutes.findIndex(
        route =>
            route.method === "GET" &&
            route.path === "/distribution-analysis"
    );

    const idIndex = registeredStaffRoutes.findIndex(
        route => route.method === "GET" && route.path === "/:id"
    );

    assert.notEqual(analysisIndex, -1);
    assert.notEqual(idIndex, -1);
    assert.ok(analysisIndex < idIndex);
    assert.equal(
        registeredStaffRoutes[analysisIndex].handler,
        mockStaffController.getStaffDistributionAnalysis
    );
});

test("маршрут зберігає middleware автентифікації та ролей", () => {
    assert.ok(staffRouteMiddleware.includes(staffAuthenticate));
    assert.deepEqual(
        staffAuthorizeRoles.receivedRoles,
        ["ADMIN", "MANAGER"]
    );
    assert.ok(staffRouteMiddleware.length >= 2);
});

let groupsData = [];
let employeesData = [];

const service = proxyquire("../src/modules/employees/staff.service.js", {
    "../../config/prisma": {
        groups: {
            findMany: async () => groupsData
        },
        employees: {
            findMany: async () => employeesData
        }
    },
    "../payroll/payroll.service": {
        getKindergartenPayroll: async () => ({
            totalMonthlySalary: 0
        }),
        calculateSalary: () => 0
    }
});

function makeEmployee(id, position) {
    return {
        id,
        first_name: `Ім'я${id}`,
        last_name: `Прізвище${id}`,
        position
    };
}

function makeGroup(id, options = {}) {
    return {
        id,
        name: `Група ${id}`,
        target_age: 4,
        capacity: 20,
        children: [],
        staff_assignments: [],
        schedules: [],
        ...options
    };
}

function prepareData() {
    const educator1 = makeEmployee(1, "EDUCATOR");
    const assistant1 = makeEmployee(2, "ASSISTANT");
    const teacher1 = makeEmployee(3, "TEACHER");
    const educator2 = makeEmployee(4, "EDUCATOR");
    const unassigned = makeEmployee(5, "TEACHER");

    groupsData = [
        makeGroup(1, {
            children: [{ id: 101 }],
            staff_assignments: [
                { role: "EDUCATOR", employee: educator1 },
                { role: "ASSISTANT", employee: assistant1 },
                { role: null, employee: teacher1 }
            ],
            schedules: [
                { teacher: educator1 },
                { teacher: educator2 }
            ]
        }),
        makeGroup(2)
    ];

    employeesData = [
        educator1,
        assistant1,
        teacher1,
        educator2,
        unassigned
    ];
}

test("визначає нестачу та надлишок персоналу", async () => {
    prepareData();

    const result = await service.getStaffDistributionAnalysis();

    assert.equal(result.summary.groupsCount, 2);
    assert.equal(result.summary.groupsWithShortage, 1);
    assert.equal(result.summary.groupsWithSurplus, 1);

    const firstGroup = result.groups.find(group => group.groupId === 1);
    const secondGroup = result.groups.find(group => group.groupId === 2);

    assert.equal(firstGroup.staffing.educators.actual, 2);
    assert.equal(firstGroup.staffing.educators.status, "SURPLUS");
    assert.equal(firstGroup.staffing.assistants.status, "OK");
    assert.equal(firstGroup.hasSurplus, true);
    assert.equal(firstGroup.hasShortage, false);

    assert.equal(secondGroup.staffing.educators.status, "SHORTAGE");
    assert.equal(secondGroup.staffing.assistants.status, "SHORTAGE");
    assert.equal(secondGroup.hasShortage, true);
});

test("не рахує працівника двічі в одній групі", async () => {
    prepareData();

    const result = await service.getStaffDistributionAnalysis();
    const firstGroup = result.groups.find(group => group.groupId === 1);
    const educator = firstGroup.assignedStaff.find(
        employee => employee.id === 1
    );

    assert.equal(
        firstGroup.assignedStaff.filter(employee => employee.id === 1).length,
        1
    );

    assert.deepEqual(
        educator.assignmentTypes,
        ["EDUCATOR_SLOT", "SCHEDULE"]
    );
});

test("знаходить працівників без прив'язки до груп", async () => {
    prepareData();

    const result = await service.getStaffDistributionAnalysis();

    assert.equal(result.summary.employeesCount, 5);
    assert.equal(result.summary.unassignedEmployeesCount, 1);
    assert.deepEqual(
        result.unassignedEmployees.map(employee => employee.id),
        [5]
    );
});

test("показує вплив зміни кількості дітей на потребу в персоналі", async () => {
    prepareData();

    const result = await service.getStaffDistributionAnalysis({
        groupId: 1,
        childrenCount: 15
    });

    assert.equal(result.scenario.groupId, 1);
    assert.equal(result.scenario.current.childrenCount, 1);
    assert.equal(result.scenario.simulated.childrenCount, 15);
    assert.equal(result.scenario.simulated.childrenDifference, 14);

    assert.equal(
        result.scenario.staffingNeed.educators.simulatedRequired,
        1
    );

    assert.equal(
        result.scenario.staffingNeed.assistants.simulatedRequired,
        1
    );

    assert.equal(result.scenario.staffingNeedChanged, false);
});

test("показує перевищення місткості у сценарії", async () => {
    prepareData();

    const result = await service.getStaffDistributionAnalysis({
        groupId: 1,
        childrenCount: 21
    });

    assert.equal(
        result.scenario.simulated.capacityStatus,
        "OVER_CAPACITY"
    );
});