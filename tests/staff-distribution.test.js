
const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

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
        employees_educator: null,
        employees_assistant: null,
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
            employees_educator: educator1,
            employees_assistant: assistant1,
            staff_assignments: [
                { employee: teacher1 }
            ],
            schedules: [
                { employees: educator1 },
                { employees: educator2 }
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