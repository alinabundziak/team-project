const test = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();
const Decimal = require("decimal.js");

function createAnalytics(options = {}) {
  const {
    children = [],
    tariff = "15000.00",
    mealRates = [{ age: 3, daily_rate: "400.00" }],
    salary = 0,
    rentPerGroup = 0,
  } = options;

  const prisma = {
    children: {
      findMany: async () => children,
    },
    groups: {
      findMany: async () => [
        {
          id: 1,
          name: "Група 1",
          children: children.map((child) => ({ id: child.id })),
        },
      ],
    },
    meal_rates: {
      findFirst: async ({ where }) => {
        const eligible = mealRates
          .filter((rate) => rate.age <= where.age.lte)
          .sort((a, b) => b.age - a.age);

        return eligible[0] ?? null;
      },
    },
  };

  const getTariffAmount = async () => {
    if (tariff === null) {
      throw new Error("Немає чинного тарифу TUITION_MONTHLY");
    }

    return new Decimal(tariff);
  };

  return proxyquire("../src/modules/analytics/analytics.service", {
    "../../config/prisma": prisma,
    "../tariffs/tariffs.service": {
      getTariffAmount,
    },
    "../payroll/payroll.service": {
      getKindergartenSalaryEstimate: async () => ({
        totalMonthlySalary: salary,
        rentPerGroup,
      }),
      calculateSalary: (position, childrenCount) => {
        const extraChildren = Math.max(0, childrenCount - 12);

        if (position === "EDUCATOR") {
          return 2000 * Math.min(childrenCount, 12) + 5000 * extraChildren;
        }

        if (position === "ASSISTANT") {
          return 20000 + 3000 * extraChildren;
        }

        throw new Error(`Невідома посада: ${position}`);
      },
    },
  });
}

test("Прогноз використовує тариф і реальну знижку дитини", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2022-01-01"),
        discount_id: 1,
        discounts: { percentage: new Decimal(20) },
      },
    ],
  });

  const result = await analytics.getRevenueForecast("2026-12");

  assert.equal(result.period, "2026-12");
  assert.equal(result.registeredChildrenCount, 1);
  assert.equal(result.expectedTuitionRevenue, "12000.00");
  assert.equal(result.expectedMealsRevenue, "8400.00");
  assert.equal(result.expectedTotalRevenue, "20400.00");
});

test("Прогноз враховує всіх зареєстрованих дітей", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
      {
        id: 2,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.getRevenueForecast("2026-12");

  assert.equal(result.registeredChildrenCount, 2);
  assert.equal(result.expectedTuitionRevenue, "30000.00");
  assert.equal(result.expectedMealsRevenue, "16800.00");
  assert.equal(result.expectedTotalRevenue, "46800.00");
});

test("Відсутній тариф викликає помилку", async () => {
  const analytics = createAnalytics({
    tariff: null,
  });

  await assert.rejects(
    analytics.getRevenueForecast("2026-12"),
    /Немає чинного тарифу/,
  );
});

test("Некоректний формат місяця викликає помилку", async () => {
  const analytics = createAnalytics();

  await assert.rejects(analytics.getRevenueForecast("2026-13"), /YYYY-MM/);
});

test("Відсутній тариф харчування викликає помилку", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
    mealRates: [],
  });

  await assert.rejects(
    analytics.getRevenueForecast("2026-12"),
    /тариф харчування/,
  );
});

test("Сценарій правильно розраховує дохід, зарплату, оренду та прибуток", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    targetGroupsCount: 1,
    candidateGroupCounts: [1],
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.scenario.simulatedRevenue, "23400.00");
  assert.equal(result.scenario.simulatedExpenses, "80400.00");
  assert.equal(result.scenario.simulatedProfit, "-57000.00");
  assert.equal(result.scenario.status, "LOSS");
  assert.equal(result.recommendedVariantId, "2026-12-groups-1");
});

test("Сценарій враховує зарплату та оренду при розрахунку збитку", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
    salary: 30000,
    rentPerGroup: 10000,
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    targetGroupsCount: 1,
    candidateGroupCounts: [1],
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.scenario.simulatedRevenue, "23400.00");
  assert.equal(result.scenario.payrollExpense, "22000.00");
  assert.equal(result.scenario.rentExpense, "50000.00");
  assert.equal(result.scenario.simulatedExpenses, "80400.00");
  assert.equal(result.scenario.simulatedProfit, "-57000.00");
  assert.equal(result.scenario.status, "LOSS");
});

test("Сценарій підтримує нерівномірний розподіл дітей між групами", async () => {
  const children = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date("2023-01-01"),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({
    children,
    salary: 30000,
    rentPerGroup: 10000,
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 9,
    targetGroupsCount: 3,
    candidateGroupCounts: [3],
    manualGroupDistributions: {
      3: [2, 3, 4],
    },
    feasibilityByGroupCount: { 3: true },
  });

  assert.deepEqual(result.scenario.groupDistribution, [2, 3, 4]);
  assert.equal(result.scenario.groupsCount, 3);
  assert.equal(result.scenario.simulatedChildrenCount, 9);
  assert.equal(result.scenario.simulatedRevenue, "210600.00");
  assert.equal(result.scenario.payrollExpense, "78000.00");
  assert.equal(result.scenario.rentExpense, "150000.00");
  assert.equal(result.scenario.simulatedExpenses, "303600.00");
  assert.equal(result.scenario.simulatedProfit, "-93000.00");
});

test("Система обирає найвигідніший допустимий сценарій", async () => {
  const children = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date("2023-01-01"),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({
    children,
    salary: 30000,
    rentPerGroup: 10000,
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 6,
    targetGroupsCount: 2,
    candidateGroupCounts: [1, 2, 3],
    feasibilityByGroupCount: {
      1: true,
      2: true,
      3: true,
    },
  });

  assert.equal(result.groupComparisonScenarios.length, 3);
  assert.equal(result.recommendedVariantId, "2026-12-groups-1");
  assert.equal(result.scenario.groupsCount, 1);
});

test("Система обирає найменший збиток, якщо всі сценарії збиткові", async () => {
  const children = Array.from({ length: 2 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date("2023-01-01"),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({
    children,
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 2,
    targetGroupsCount: 2,
    candidateGroupCounts: [1, 2],
    feasibilityByGroupCount: {
      1: true,
      2: true,
    },
  });

  assert.equal(result.groupComparisonScenarios.length, 2);
  assert.equal(result.scenario.groupsCount, 1);
  assert.equal(result.scenario.status, "LOSS");
  assert.equal(result.recommendedVariantId, "2026-12-groups-1");
});

test("Система не рекомендує сценарій без підтвердженої допустимості", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    targetGroupsCount: 1,
    candidateGroupCounts: [1],
  });

  assert.equal(result.recommendedVariantId, null);
  assert.equal(result.scenario, null);
  assert.equal(result.rankedFeasibleScenarios.length, 0);
});

test("Річна оплата застосовує додаткову знижку 12% на навчання", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    candidateGroupCounts: [1],
    paymentPlan: "ANNUAL",
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.variants[0].revenue.tuition, "13200.00");
  assert.equal(result.variants[0].revenue.meals, "8400.00");
  assert.equal(result.variants[0].accrualProfit, "-58800.00");
});

test("Річна оплата застосовується після персональної знижки", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: 1,
        discounts: { percentage: new Decimal(20) },
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    candidateGroupCounts: [1],
    paymentPlan: "ANNUAL",
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.variants[0].revenue.tuition, "10560.00");
  assert.equal(result.variants[0].revenue.meals, "8400.00");
  assert.equal(result.variants[0].accrualProfit, "-61440.00");
});

test("Сценарій відхиляє знижку понад 30%", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  await assert.rejects(
    analytics.calculateScenario({
      period: "2026-12",
      childrenCount: 1,
      candidateGroupCounts: [1],
      discountChangePercent: 35,
      feasibilityByGroupCount: { 1: true },
    }),
    /знижк/i,
  );
});

test("Сценарій не дозволяє понад 20 дітей в одній групі", async () => {
  const children = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date("2023-01-01"),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({ children });

  await assert.rejects(
    analytics.calculateScenario({
      period: "2026-12",
      childrenCount: 21,
      candidateGroupCounts: [1],
      feasibilityByGroupCount: { 1: true },
    }),
    /20/,
  );
});

test("Сценарій враховує конкретних дітей через includedChildIds", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: 1,
        discounts: { percentage: new Decimal(20) },
      },
      {
        id: 2,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    includedChildIds: [2],
    candidateGroupCounts: [1],
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.variants[0].revenue.tuition, "15000.00");
  assert.equal(result.variants[0].revenue.meals, "8400.00");
  assert.equal(result.variants[0].accrualProfit, "-57000.00");
});

test("При зменшенні кількості дітей використовується середня знижка", async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date("2023-01-01"),
        discount_id: 1,
        discounts: { percentage: new Decimal(20) },
      },
      {
        id: 2,
        birth_date: new Date("2023-01-01"),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: "2026-12",
    childrenCount: 1,
    candidateGroupCounts: [1],
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.variants[0].revenue.tuition, "13500.00");
  assert.equal(result.variants[0].revenue.meals, "8400.00");
  assert.equal(result.variants[0].accrualProfit, "-58500.00");
});
test("Сценарій відхиляє ручний розподіл із неправильною сумою дітей", async () => {
  const children = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date("2023-01-01"),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({ children });

  await assert.rejects(
    analytics.calculateScenario({
      period: "2026-12",
      childrenCount: 9,
      candidateGroupCounts: [3],
      manualGroupDistributions: {
        3: [2, 3, 5],
      },
      feasibilityByGroupCount: { 3: true },
    }),
    /Сума дітей у групах має дорівнювати childrenCount/,
  );
});

test("Сценарій не дозволяє понад 20 варіантів кількості груп", async () => {
  const children = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date("2023-01-01"),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({ children });

  await assert.rejects(
    analytics.calculateScenario({
      period: "2026-12",
      childrenCount: 21,
      candidateGroupCounts: Array.from({ length: 21 }, (_, index) => index + 1),
    }),
    /не більше 20 варіантів груп/,
  );
});
