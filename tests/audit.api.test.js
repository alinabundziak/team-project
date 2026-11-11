
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

function testAuthenticate(req, res, next) {
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
}

function createApp() {
  const repository = {
    findMany: async () => [],
    count: async () => 0,
  };

  const auditService = proxyquire(
    "../src/modules/audit/audit.service.js",
    {
      "./audit.repository": repository,
    }
  );

  const auditController = proxyquire(
    "../src/modules/audit/audit.controller.js",
    {
      "./audit.service": auditService,
    }
  );

  const auditRoutes = proxyquire(
    "../src/modules/audit/audit.routes.js",
    {
      "../../middleware/authenticate": testAuthenticate,
      "./audit.controller": auditController,
    }
  );

  const app = express();

  app.use(express.json());
  app.use("/api/audit-logs", auditRoutes);

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: err.message,
    });
  });

  return app;
}

const app = createApp();

test("ADMIN отримує список журналу аудиту через реальний контролер і сервіс", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, []);
  assert.deepEqual(response.body.meta, {
    page: 1,
    limit: 20,
    total: 0,
  });
});

test("без автентифікації повертається 401", async () => {
  const response = await request(app)
    .get("/api/audit-logs");

  assert.equal(response.status, 401);
});

test("MANAGER не має доступу до журналу аудиту", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .set("Authorization", "Bearer manager");

  assert.equal(response.status, 403);
});

test("TEACHER не має доступу до журналу аудиту", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .set("Authorization", "Bearer teacher");

  assert.equal(response.status, 403);
});

test("PARENT не має доступу до журналу аудиту", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .set("Authorization", "Bearer parent");

  assert.equal(response.status, 403);
});

test("маршрут приймає коректні параметри фільтрації", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({
      tableName: "public.children",
      operation: "UPDATE",
      from: "2026-11-01",
      to: "2026-11-05",
      page: 2,
      limit: 10,
    })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.meta, {
    page: 2,
    limit: 10,
    total: 0,
  });
});

test("некоректна операція повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({ operation: "INVALID" })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("некоректний формат дати повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({ from: "01-11-2026" })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("дата from пізніше за to повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({
      from: "2026-11-10",
      to: "2026-11-05",
    })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("неіснуюча календарна дата повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({ from: "2026-02-30" })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("limit більший за 100 повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({ limit: 101 })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("нульовий page повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({ page: 0 })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("нульовий limit повертає 400", async () => {
  const response = await request(app)
    .get("/api/audit-logs")
    .query({ limit: 0 })
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 400);
});

test("POST на маршрут аудиту повертає 404", async () => {
  const response = await request(app)
    .post("/api/audit-logs")
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 404);
});

test("PATCH на маршрут аудиту повертає 404", async () => {
  const response = await request(app)
    .patch("/api/audit-logs")
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 404);
});

test("DELETE на маршрут аудиту повертає 404", async () => {
  const response = await request(app)
    .delete("/api/audit-logs")
    .set("Authorization", "Bearer admin");

  assert.equal(response.status, 404);
});
