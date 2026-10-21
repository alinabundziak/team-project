
const test = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire");

function createMockPrisma(groups, employees) {
    return {
        groups: {
            findMany: async () => groups
        },
        employees: {
            findMany: async () => employees
        }
    };
}

function loadService(groups, employees) {
    return proxyquire("../src/modules/optimization/optimization.service", {
        "../../config/prisma": createMockPrisma(groups, employees)
    });
}

test("пропонує перерозподіл дітей до групи відповідного віку", async () => {
    const groups = [
        {
            id: 1,
            name: "Молодша група",
            target_age: 3,
            capacity: 10,
            room: { id: 1, name: "Кімната 1", capacity: 10 },
            children: Array.from({ length: 12 }, (_, i) => ({
                id: i + 1,
                first_name: "Дитина",
                last_name: String(i + 1),
                birth_date: new Date("2023-01-01")
            })),
            employees_educator: null,
            employees_assistant: null,
            staff_assignments: []
        },
        {
            id: 2,
            name: "Друга молодша група",
            target_age: 3,
            capacity: 10,
            room: { id: 2, name: "Кімната 2", capacity: 10 },
            children: Array.from({ length: 6 }, (_, i) => ({
                id: i + 20,
                first_name: "Дитина",
                last_name: String(i + 20),
                birth_date: new Date("2023-02-01")
            })),
            employees_educator: null,
            employees_assistant: null,
            staff_assignments: []
        }
    ];

    const service = loadService(groups, []);

    const result = await service.getOptimizationRecommendations();

    const recommendation = result.recommendations.find(
        item => item.type === "CHILD_TRANSFER"
    );

    assert.ok(recommendation);
    assert.equal(recommendation.sourceGroup.id, 1);
    assert.equal(recommendation.targetGroup.id, 2);
    assert.equal(recommendation.suggestedChildrenCount, 2);
    assert.equal(recommendation.applied, false);
});

test("пропонує працівника потрібної посади для групи без персоналу", async () => {
    const groups = [
        {
            id: 1,
            name: "Середня група",
            target_age: 4,
            capacity: 15,
            room: { id: 1, name: "Кімната 1", capacity: 15 },
            children: [],
            employees_educator: null,
            employees_assistant: null,
            staff_assignments: []
        }
    ];

    const employees = [
        {
            id: 10,
            first_name: "Олена",
            last_name: "Іваненко",
            position: "EDUCATOR"
        },
        {
            id: 11,
            first_name: "Ірина",
            last_name: "Петренко",
            position: "ASSISTANT"
        }
    ];

    const service = loadService(groups, employees);

    const result = await service.getOptimizationRecommendations();

    const staffRecommendations = result.recommendations.filter(
        item => item.type === "STAFF_ASSIGNMENT"
    );

    assert.equal(staffRecommendations.length, 2);
    assert.ok(
        staffRecommendations.some(item => item.employee.position === "EDUCATOR")
    );
    assert.ok(
        staffRecommendations.some(item => item.employee.position === "ASSISTANT")
    );
    assert.ok(staffRecommendations.every(item => item.applied === false));
});

test("лише формує рекомендації та не змінює дані", async () => {
    let writeOperations = 0;

    const prisma = {
        groups: {
            findMany: async () => []
        },
        employees: {
            findMany: async () => []
        }
    };

    for (const model of Object.values(prisma)) {
        for (const [methodName, method] of Object.entries(model)) {
            if (methodName !== "findMany") {
                model[methodName] = async () => {
                    writeOperations++;
                };
            }
        }
    }

    const service = proxyquire("../src/modules/optimization/optimization.service", {
        "../../config/prisma": prisma
    });

    const result = await service.getOptimizationRecommendations();

    assert.equal(writeOperations, 0);
    assert.equal(result.appliedAutomatically, false);
    assert.equal(result.recommendationsCount, 0);
    assert.deepEqual(result.recommendations, []);
});
