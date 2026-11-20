
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

function createApp() {
  const calls = {
    forecast: [],
    scenario: [],
  };

  const authModule = {
    authenticate(req, res, next) {
      const token = req.headers.authorization;

      if (token === "Bearer admin") {
        req.user = { id: 1, role: "ADMIN" };
      } else if (token === "Bearer manager") {
        req.user = { id: 2, role: "MANAGER" };
      } else if (token === "Bearer teacher") {
        req.user = { id: 3, role: "TEACHER" };
      } else if (token === "Bearer parent") {
        req.user = { id: 4, role: "PARENT" };
      }

      next();
    },
  };

  const authorizeRoles = (role) => (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Необхідна автентифікація",
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: "Доступ заборонено",
      });
    }

    next();
  };

  const controller = {
    async getFinancialSummary(req, res) {
      res.json({});
    },

    async getDebts(req, res) {
      res.json({});
    },

    async getRevenueForecast(req, res, next) {
      try {
        calls.forecast.push(req.forecastPeriod);

        res.json({
          period: req.forecastPeriod,
          registeredChildrenCount: 10,
          expectedTuitionRevenue: 100000,
          expectedMealsRevenue: 20000,
          expectedTotalRevenue: 120000,
        });
      } catch (error) {
        next(error);
      }
    },

    async runScenario(req, res, next) {
      try {
        calls.scenario.push(req.body);

        res.json({
          scenarioId: req.body.scenarioId,
          variants: [],
          recommendedVariantId: null,
        });
      } catch (error) {
        next(error);
      }
    },

    async getStaffOptimization(req, res) {
      res.json({});
    },
  };

  const analyticsRouter = proxyquire(
    "../src/modules/analytics/analytics.routes.js",
    {
      "./analytics.controller": controller,
      "../../middleware/authenticate": authModule.authenticate,
      "../../middleware/authorizeRoles": authorizeRoles,
      "../../config/roles": {
        ROLES: {
          ADMIN: "ADMIN",
        },
      },
      "../../middleware/validate": {
        validateDateQuery(req, res, next) {
          next();
        },
      },
    }
  );

  const app = express();

  app.use(express.json());
  app.use("/api/analytics", analyticsRouter);

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  });

  return { app, calls };
}

const validScenario = {
  scenarioId: "scenario-2026-11-a",
  period: "2026-11",
  childrenCount: 36,
  candidateGroupCounts: [2, 3],
  tariffPriceChangePercent: 0,
  discountChangePercent: 0,
  paymentPlan: "MONTHLY",
};

test("ADMIN отримує прогноз за вказаний період", async () => {
  const { app, calls } = createApp();

  const response = await request(app)
    .get("/api/analytics/revenue-forecast?period=2026-11")
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 200);
  assert.equal(response.body.period, "2026-11");
  assert.equal(calls.forecast[0], "2026-11");
});

test("прогноз використовує поточний місяць, якщо period не передано", async () => {
  const { app, calls } = createApp();

  const now = new Date();
  const expectedPeriod = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const response = await request(app)
    .get("/api/analytics/revenue-forecast")
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 200);
  assert.equal(response.body.period, expectedPeriod);
  assert.equal(calls.forecast[0], expectedPeriod);
});

test("некоректний період прогнозу повертає 400", async () => {
  const { app } = createApp();

  const invalidPeriods = [
    "2026-13",
    "2026-00",
    "2026-1",
    "26-11",
    "invalid",
  ];

  for (const period of invalidPeriods) {
    const response = await request(app)
      .get(`/api/analytics/revenue-forecast?period=${period}`)
      .set("Authorization", "Bearer admin");

    assert.equal(response.status, 400, `period=${period}`);
  }
});

test("ADMIN може надіслати сценарій з новими параметрами", async () => {
  const { app, calls } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send(validScenario);

  assert.equal(response.status, 200);
  assert.equal(calls.scenario.length, 1);
  assert.equal(calls.scenario[0].period, "2026-11");
  assert.equal(calls.scenario[0].childrenCount, 36);
  assert.deepEqual(calls.scenario[0].candidateGroupCounts, [2, 3]);
  assert.equal(calls.scenario[0].paymentPlan, "MONTHLY");
});

test("scenarioId може бути звичайним рядком, а не UUID", async () => {
  const { app, calls } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      scenarioId: "scenario-custom-2026",
    });

  assert.equal(response.status, 200);
  assert.equal(calls.scenario[0].scenarioId, "scenario-custom-2026");
});

test("сценарій без period повертає 400", async () => {
  const { app } = createApp();
  const { period, ...scenarioWithoutPeriod } = validScenario;

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send(scenarioWithoutPeriod);

  assert.equal(response.status, 400);
});

test("некоректний period сценарію повертає 400", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      period: "2026-13",
    });

  assert.equal(response.status, 400);
});

test("тіло сценарію має бути JSON-об'єктом", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .set("Content-Type", "application/json")
    .send("[]");

  assert.equal(response.status, 400);
});

test("childrenCount має бути додатним цілим числом", async () => {
  const { app } = createApp();

  const invalidValues = [0, -1, 2.5, "36", null];

  for (const value of invalidValues) {
    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        childrenCount: value,
      });

    assert.equal(response.status, 400, `childrenCount=${value}`);
  }
});

test("candidateGroupCounts має бути непорожнім масивом", async () => {
  const { app } = createApp();

  const invalidValues = [null, "3", [], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]];

  for (const value of invalidValues) {
    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        candidateGroupCounts: value,
      });

    assert.equal(response.status, 400);
  }
});

test("candidateGroupCounts не повинен містити некоректні значення", async () => {
  const { app } = createApp();

  const invalidValues = [
    [0],
    [-1],
    [2.5],
    ["3"],
    [21],
    [37],
    [1, 1],
    [2, 37],
  ];

  for (const value of invalidValues) {
    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        candidateGroupCounts: value,
      });

    assert.equal(
      response.status,
      400,
      `candidateGroupCounts=${JSON.stringify(value)}`
    );
  }
});

test("кожна група повинна вміщувати не більше 20 дітей", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      childrenCount: 41,
      candidateGroupCounts: [2],
    });

  assert.equal(response.status, 400);
});

test("некоректні значення discountChangePercent відхиляються", async () => {
  const { app } = createApp();

  const invalidValues = ["abc", null];

  for (const value of invalidValues) {
    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        discountChangePercent: value,
      });

    assert.equal(
      response.status,
      400,
      `discountChangePercent=${value}`
    );
  }
});

test("скінченні значення discountChangePercent приймаються", async () => {
  for (const value of [-10, 0, 70, 100, -100]) {
    const { app } = createApp();

    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        discountChangePercent: value,
      });

    assert.equal(response.status, 200, `discountChangePercent=${value}`);
  }
});

test("некоректний scenarioId відхиляється", async () => {
  const { app } = createApp();

  const invalidIds = [
    "",
    "   ",
    "a".repeat(129),
  ];

  for (const scenarioId of invalidIds) {
    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        scenarioId,
      });

    assert.equal(response.status, 400);
  }
});

test("відсутній scenarioId відхиляється", async () => {
  const { app } = createApp();
  const { scenarioId, ...scenarioWithoutId } = validScenario;

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send(scenarioWithoutId);

  assert.equal(response.status, 400);
});

test("tariffPriceChangePercent має бути в межах -100..100", async () => {
  const { app } = createApp();

  const invalidValues = ["10", "abc", null, -100.01, 100.01];

  for (const value of invalidValues) {
    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        tariffPriceChangePercent: value,
      });

    assert.equal(
      response.status,
      400,
      `tariffPriceChangePercent=${value}`
    );
  }
});

test("граничні значення tariffPriceChangePercent приймаються", async () => {
  for (const value of [-100, 0, 100]) {
    const { app } = createApp();

    const response = await request(app)
      .post("/api/analytics/scenarios")
      .set("Authorization", "Bearer admin")
      .send({
        ...validScenario,
        tariffPriceChangePercent: value,
      });

    assert.equal(response.status, 200);
  }
});

test("paymentPlan за замовчуванням MONTHLY", async () => {
  const { app, calls } = createApp();
  const { paymentPlan, ...scenario } = validScenario;

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send(scenario);

  assert.equal(response.status, 200);
  assert.equal(calls.scenario[0].paymentPlan, "MONTHLY");
});

test("paymentPlan ANNUAL приймається", async () => {
  const { app, calls } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      paymentPlan: "ANNUAL",
    });

  assert.equal(response.status, 200);
  assert.equal(calls.scenario[0].paymentPlan, "ANNUAL");
});

test("некоректний paymentPlan відхиляється", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      paymentPlan: "WEEKLY",
    });

  assert.equal(response.status, 400);
});

test("includedChildIds повинні бути унікальними та відповідати childrenCount", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      includedChildIds: ["child-1", "child-1"],
    });

  assert.equal(response.status, 400);
});

test("includedChildIds правильної кількості приймаються", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer admin")
    .send({
      ...validScenario,
      includedChildIds: Array.from(
        { length: 36 },
        (_, index) => `child-${index + 1}`
      ),
    });

  assert.equal(response.status, 200);
});

test("неавторизований користувач не отримує прогноз", async () => {
  const { app } = createApp();

  const response = await request(app)
    .get("/api/analytics/revenue-forecast");

  assert.equal(response.status, 401);
});

test("MANAGER не має доступу до прогнозу", async () => {
  const { app } = createApp();

  const response = await request(app)
    .get("/api/analytics/revenue-forecast")
    .set("Authorization", "Bearer manager");

  assert.equal(response.status, 403);
});

test("TEACHER не має доступу до прогнозу", async () => {
  const { app } = createApp();

  const response = await request(app)
    .get("/api/analytics/revenue-forecast")
    .set("Authorization", "Bearer teacher");

  assert.equal(response.status, 403);
});

test("PARENT не має доступу до прогнозу", async () => {
  const { app } = createApp();

  const response = await request(app)
    .get("/api/analytics/revenue-forecast")
    .set("Authorization", "Bearer parent");

  assert.equal(response.status, 403);
});

test("неавторизований користувач не може запускати сценарії", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .send(validScenario);

  assert.equal(response.status, 401);
});

test("MANAGER не може запускати сценарії", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer manager")
    .send(validScenario);

  assert.equal(response.status, 403);
});

test("TEACHER не може запускати сценарії", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer teacher")
    .send(validScenario);

  assert.equal(response.status, 403);
});

test("PARENT не може запускати сценарії", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/analytics/scenarios")
    .set("Authorization", "Bearer parent")
    .send(validScenario);

  assert.equal(response.status, 403);
});
