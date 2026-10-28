const test = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire");

function createMockPrisma(groups, employees, children = []) {
    return {
        groups: {
            findMany: async () => groups
        },
        employees: {
            findMany: async () => employees
        },
        children: {
            findMany: async () => children
        }
    };
}

function createChildren(count, ageYears, startId = 1) {
    const birthDate = new Date();
    birthDate.setUTCFullYear(
        birthDate.getUTCFullYear() - ageYears
    );

    return Array.from({ length: count }, (_, index) => ({
        id: startId + index,
        first_name: "Дитина",
        last_name: String(startId + index),
        birth_date: new Date(birthDate),
        group_id: null
    }));
}

test("рекомендує потрібну кількість груп окремо для кожного віку", async () => {
    const children = [
        ...createChildren(21, 3, 1),
        ...createChildren(5, 4, 100)
    ];

    const service = loadService([], [], children);
    const result = await service.getOptimizationRecommendations();

    const groupRecommendations = result.recommendations.filter(
        item => item.type === "GROUP_COUNT"
    );

    assert.equal(groupRecommendations.length, 2);

    const ageThreeRecommendation = groupRecommendations.find(
        item => item.ageYears === 3
    );
    assert.equal(ageThreeRecommendation.additionalGroupsCount, 2);
    assert.equal(ageThreeRecommendation.recommendedGroupCount, 2);
    assert.equal(ageThreeRecommendation.applied, false);

    const ageFourRecommendation = groupRecommendations.find(
        item => item.ageYears === 4
    );
    assert.equal(ageFourRecommendation.additionalGroupsCount, 1);
    assert.equal(ageFourRecommendation.recommendedGroupCount, 1);
});

test("не рекомендує додаткову групу, якщо наявної місткості достатньо", async () => {
    const children = createChildren(10, 3);
    const groups = [{
        id: 1,
        name: "Група 3 років",
        target_age: 3,
        capacity: 10,
        room: { id: 1, name: "Кімната", capacity: 10 },
        children,
        employees_educator: null,
        employees_assistant: null,
        educator_id: null,
        assistant_id: null,
        staff_assignments: [],
        schedules: []
    }];

    const service = loadService(groups, [], children);
    const result = await service.getOptimizationRecommendations();

    assert.equal(
        result.recommendations.filter(
            item => item.type === "GROUP_COUNT"
        ).length,
        0
    );
});

test("враховує місткість кімнати при рекомендації кількості груп", async () => {
    const children = createChildren(11, 3);
    const groups = [{
        id: 1,
        name: "Група 3 років",
        target_age: 3,
        capacity: 20,
        room: { id: 1, name: "Мала кімната", capacity: 10 },
        children,
        employees_educator: null,
        employees_assistant: null,
        educator_id: null,
        assistant_id: null,
        staff_assignments: [],
        schedules: []
    }];

    const service = loadService(groups, [], children);
    const result = await service.getOptimizationRecommendations();

    const recommendation = result.recommendations.find(
        item => item.type === "GROUP_COUNT"
    );

    assert.ok(recommendation);
    assert.equal(recommendation.currentCapacity, 10);
    assert.equal(recommendation.additionalGroupsCount, 1);
    assert.equal(recommendation.recommendedGroupCount, 2);
});

function loadService(groups, employees, children) {
    return proxyquire("../src/modules/optimization/optimization.service", {
        "../../config/prisma": createMockPrisma(groups, employees, children)
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

    const service = loadService(groups, [], []);

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

    const service = loadService(groups, employees, []);

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
        },
        children: {
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

test("не рекомендує переводити дитину до групи понад ліміт 20", async () => {
    const sourceChildren = createChildren(26, 3, 1);
    const targetChildren = createChildren(20, 3, 100);
    const children = [...sourceChildren, ...targetChildren];

    const groups = [
        {
            id: 1,
            name: "Переповнена група",
            target_age: 3,
            capacity: 25,
            room: { id: 1, name: "Кімната 1", capacity: 25 },
            children: sourceChildren,
            employees_educator: null,
            employees_assistant: null,
            educator_id: null,
            assistant_id: null,
            staff_assignments: [],
            schedules: []
        },
        {
            id: 2,
            name: "Група з 20 дітьми",
            target_age: 3,
            capacity: 25,
            room: { id: 2, name: "Кімната 2", capacity: 25 },
            children: targetChildren,
            employees_educator: null,
            employees_assistant: null,
            educator_id: null,
            assistant_id: null,
            staff_assignments: [],
            schedules: []
        }
    ];

    const service = loadService(groups, [], children);
    const result = await service.getOptimizationRecommendations();

    const childTransfers = result.recommendations.filter(
        item => item.type === "CHILD_TRANSFER"
    );

    assert.equal(childTransfers.length, 0);
});

function createOptimizationControllerResponse() {
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

test("повертає рекомендації у полі data зі статусом 200", async () => {
    const recommendations = { groups: [], staff: [] };
    const controller = proxyquire(
        "../src/modules/optimization/optimization.controller.js",
        {
            "./optimization.service": {
                getOptimizationRecommendations: async () => recommendations
            }
        }
    );
    const res = createOptimizationControllerResponse();

    await controller.getRecommendations({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: recommendations });
});