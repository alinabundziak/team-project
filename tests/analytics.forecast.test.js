
const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const Decimal = require('decimal.js');

function createAnalytics(options = {}) {
  const {
  children = [],
  tariff = '15000.00',
  mealRates = [{ age: 3, daily_rate: '400.00' }],
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
        name: 'Група 1',
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
      throw new Error('Немає чинного тарифу TUITION_MONTHLY');
    }

    return new Decimal(tariff);
  };

  return proxyquire('../src/modules/analytics/analytics.service', {
    '../../config/prisma': prisma,
    '../tariffs/tariffs.service': {
      getTariffAmount,
    },
    '../payroll/payroll.service': {
      getKindergartenSalaryEstimate: async () => ({
  totalMonthlySalary: salary,
  rentPerGroup,
}),
    },
  });
}

test('Прогноз використовує тариф і реальну знижку дитини', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2022-01-01'),
        discount_id: 1,
        discounts: { percentage: new Decimal(20) },
      },
    ],
  });

  const result = await analytics.getRevenueForecast('2026-12');

  assert.equal(result.period, '2026-12');
  assert.equal(result.registeredChildrenCount, 1);
  assert.equal(result.expectedTuitionRevenue, '12000.00');
  assert.equal(result.expectedMealsRevenue, '8400.00');
  assert.equal(result.expectedTotalRevenue, '20400.00');
});

test('Прогноз враховує всіх зареєстрованих дітей', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
      {
        id: 2,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.getRevenueForecast('2026-12');

  assert.equal(result.registeredChildrenCount, 2);
  assert.equal(result.expectedTuitionRevenue, '30000.00');
  assert.equal(result.expectedMealsRevenue, '16800.00');
  assert.equal(result.expectedTotalRevenue, '46800.00');
});

test('Відсутній тариф викликає помилку', async () => {
  const analytics = createAnalytics({
    tariff: null,
  });

  await assert.rejects(
    analytics.getRevenueForecast('2026-12'),
    /Немає чинного тарифу/,
  );
});

test('Некоректний формат місяця викликає помилку', async () => {
  const analytics = createAnalytics();

  await assert.rejects(
    analytics.getRevenueForecast('2026-13'),
    /YYYY-MM/,
  );
});

test('Відсутній тариф харчування викликає помилку', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
    ],
    mealRates: [],
  });

  await assert.rejects(
    analytics.getRevenueForecast('2026-12'),
    /тариф харчування/,
  );
});


test('Сценарій правильно розраховує дохід, зарплату, оренду та прибуток', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: '2026-12',
    childrenCount: 1,
    targetGroupsCount: 1,
    candidateGroupCounts: [1],
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.scenario.simulatedRevenue, '23400.00');
  assert.equal(result.scenario.simulatedExpenses, '0.00');
  assert.equal(result.scenario.simulatedProfit, '23400.00');
  assert.equal(result.scenario.status, 'PROFIT');
  assert.equal(result.recommendedVariantId, '2026-12-groups-1');
});


test('Сценарій враховує зарплату та оренду при розрахунку збитку', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
    ],
    salary: 30000,
    rentPerGroup: 10000,
  });

  const result = await analytics.calculateScenario({
    period: '2026-12',
    childrenCount: 1,
    targetGroupsCount: 1,
    candidateGroupCounts: [1],
    feasibilityByGroupCount: { 1: true },
  });

  assert.equal(result.scenario.simulatedRevenue, '23400.00');
  assert.equal(result.scenario.payrollExpense, '30000.00');
  assert.equal(result.scenario.rentExpense, '10000.00');
  assert.equal(result.scenario.simulatedExpenses, '40000.00');
  assert.equal(result.scenario.simulatedProfit, '-16600.00');
  assert.equal(result.scenario.status, 'LOSS');
});


test('Сценарій підтримує нерівномірний розподіл дітей між групами', async () => {
  const children = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date('2023-01-01'),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({
    children,
    salary: 30000,
    rentPerGroup: 10000,
  });

  const result = await analytics.calculateScenario({
    period: '2026-12',
    childrenCount: 9,
    targetGroupsCount: 3,
    candidateGroupCounts: [3],
    groupDistribution: [2, 3, 4],
    feasibilityByGroupCount: { 3: true },
  });

  assert.deepEqual(result.scenario.groupDistribution, [2, 3, 4]);
  assert.equal(result.scenario.groupsCount, 3);
  assert.equal(result.scenario.simulatedChildrenCount, 9);
  assert.equal(result.scenario.simulatedRevenue, '210600.00');
  assert.equal(result.scenario.payrollExpense, '30000.00');
  assert.equal(result.scenario.rentExpense, '30000.00');
  assert.equal(result.scenario.simulatedExpenses, '60000.00');
  assert.equal(result.scenario.simulatedProfit, '150600.00');
});


test('Система обирає найвигідніший допустимий сценарій', async () => {
  const children = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    birth_date: new Date('2023-01-01'),
    discount_id: null,
    discounts: null,
  }));

  const analytics = createAnalytics({
    children,
    salary: 30000,
    rentPerGroup: 10000,
  });

  const result = await analytics.calculateScenario({
    period: '2026-12',
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
  assert.equal(result.recommendedVariantId, '2026-12-groups-1');
  assert.equal(result.scenario.groupsCount, 1);
});

test('Система обирає найменший збиток, якщо всі сценарії збиткові', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
    ],
    salary: 100000,
    rentPerGroup: 50000,
  });

  const result = await analytics.calculateScenario({
    period: '2026-12',
    childrenCount: 1,
    targetGroupsCount: 2,
    candidateGroupCounts: [1, 2],
    feasibilityByGroupCount: {
      1: true,
      2: true,
    },
  });

  assert.equal(result.scenario.groupsCount, 1);
  assert.equal(result.scenario.status, 'LOSS');
  assert.equal(result.recommendedVariantId, '2026-12-groups-1');
});

test('Система не рекомендує сценарій без підтвердженої допустимості', async () => {
  const analytics = createAnalytics({
    children: [
      {
        id: 1,
        birth_date: new Date('2023-01-01'),
        discount_id: null,
        discounts: null,
      },
    ],
  });

  const result = await analytics.calculateScenario({
    period: '2026-12',
    childrenCount: 1,
    targetGroupsCount: 1,
    candidateGroupCounts: [1],
  });

  assert.equal(result.recommendedVariantId, null);
  assert.equal(result.scenario, null);
  assert.equal(result.rankedFeasibleScenarios.length, 0);
});
