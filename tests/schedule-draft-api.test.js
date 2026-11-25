
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noCallThru();


function createApp() {
  let receivedData = null;
  const scheduleQueries = [];

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

    authorizeRoles(...allowedRoles) {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({
            error: "Необхідна автентифікація",
          });
        }

        if (!allowedRoles.includes(req.user.role)) {
          return res.status(403).json({
            error: "Доступ заборонено",
          });
        }

        next();
      };
    },
  };

  const scheduleService = {
    async checkScheduleConflicts() {
      return { valid: true };
    },

    async generateDraftSchedule(data) {
      receivedData = data;

      return {
        draft: [],
        errors: [],
        balanceCheck: {
          isBalanced: true,
          imbalances: [],
        },
        received: data,
      };
    },
  };

  const prismaMock = {
    schedules: {
      async findMany(options) {
        scheduleQueries.push(options);
        return [];
      },
    },

    parents: {
      async findUnique() {
        return {
          child_parents: [
            { child: { group_id: 10 } },
            { child: { group_id: 11 } },
            { child: { group_id: null } },
          ],
        };
      },
    },

    employees: {
      async findUnique() {
        return { id: 3 };
      },
    },
  };

  const scheduleRouter = proxyquire("../src/routes/schedule.router.js", {
    "../config/prisma": prismaMock,
    "../services/schedule.service": scheduleService,
    "../middleware/authenticate": authModule,
  });

  const app = express();
  app.use(express.json());
  app.use("/api", scheduleRouter);

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
  });

  return {
    app,
    getReceivedData: () => receivedData,
    wasServiceCalled: () => receivedData !== null,
    getScheduleQueries: () => scheduleQueries,
  };
}


const validItem = {
  group_id: 1,
  activity_id: 2,
  teacher_id: 3,
  room_id: 4,
  duration: 45,
};

async function sendDraftRequest(app, body = { day_of_week: 1, items: [validItem] }) {
  return request(app)
    .post("/api/schedules/generate-draft")
    .set("Authorization", "Bearer admin")
    .send(body);
}

// Доступ

test("ADMIN може створити чернетку розкладу", async () => {
  const { app, wasServiceCalled } = createApp();

  const response = await sendDraftRequest(app);

  assert.equal(response.status, 200);
  assert.equal(wasServiceCalled(), true);
  assert.equal(response.body.received.day_of_week, 1);
});

test("MANAGER може створити чернетку розкладу", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/schedules/generate-draft")
    .set("Authorization", "Bearer manager")
    .send({ day_of_week: 1, items: [validItem] });

  assert.equal(response.status, 200);
});

test("без автентифікації повертається 401", async () => {
  const { app } = createApp();

  const response = await request(app)
    .post("/api/schedules/generate-draft")
    .send({ day_of_week: 1, items: [validItem] });

  assert.equal(response.status, 401);
});

test("TEACHER не може створити чернетку розкладу", async () => {
  const { app, wasServiceCalled } = createApp();

  const response = await request(app)
    .post("/api/schedules/generate-draft")
    .set("Authorization", "Bearer teacher")
    .send({ day_of_week: 1, items: [validItem] });

  assert.equal(response.status, 403);
  assert.equal(wasServiceCalled(), false);
});

// Перевірка day_of_week

test("day_of_week = 1 є допустимим", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 1,
    items: [validItem],
  });

  assert.equal(response.status, 200);
});

test("day_of_week = 7 є допустимим", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 7,
    items: [validItem],
  });

  assert.equal(response.status, 200);
});

test('day_of_week = "1" є допустимим числовим рядком', async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: "1",
    items: [validItem],
  });

  assert.equal(response.status, 200);
});

test("day_of_week = 0 повертає 400", async () => {
  const { app, wasServiceCalled } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 0,
    items: [validItem],
  });

  assert.equal(response.status, 400);
  assert.equal(wasServiceCalled(), false);
});

test("day_of_week = 8 повертає 400", async () => {
  const { app, wasServiceCalled } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 8,
    items: [validItem],
  });

  assert.equal(response.status, 400);
  assert.equal(wasServiceCalled(), false);
});

test("відсутній day_of_week повертає 400", async () => {
  const { app, wasServiceCalled } = createApp();

  const response = await sendDraftRequest(app, {
    items: [validItem],
  });

  assert.equal(response.status, 400);
  assert.equal(wasServiceCalled(), false);
});

test("дробове значення day_of_week повертає 400", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 1.5,
    items: [validItem],
  });

  assert.equal(response.status, 400);
});

test("порожній рядок day_of_week повертає 400", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: "",
    items: [validItem],
  });

  assert.equal(response.status, 400);
});

// Перевірка items

test("items має бути масивом", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 1,
    items: {},
  });

  assert.equal(response.status, 400);
});

test("відсутній items повертає 400", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 1,
  });

  assert.equal(response.status, 400);
});

test("елемент items має бути об'єктом", async () => {
  const { app } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 1,
    items: [null],
  });

  assert.equal(response.status, 400);
});

test("порожній масив items передається до сервісу", async () => {
  const { app, wasServiceCalled, getReceivedData } = createApp();

  const response = await sendDraftRequest(app, {
    day_of_week: 1,
    items: [],
  });

  assert.equal(response.status, 200);
  assert.equal(wasServiceCalled(), true);
  assert.deepEqual(getReceivedData(), {
    day_of_week: 1,
    items: [],
  });
});

// Перевірка обов'язкових полів

for (const field of [
  "group_id",
  "activity_id",
  "teacher_id",
  "room_id",
  "duration",
]) {
  test(`відсутнє поле ${field} повертає 400`, async () => {
    const { app } = createApp();

    const item = { ...validItem };
    delete item[field];

    const response = await sendDraftRequest(app, {
      day_of_week: 1,
      items: [item],
    });

    assert.equal(response.status, 400);
  });

  test(`нульове значення ${field} повертає 400`, async () => {
    const { app } = createApp();

    const response = await sendDraftRequest(app, {
      day_of_week: 1,
      items: [{ ...validItem, [field]: 0 }],
    });

    assert.equal(response.status, 400);
  });

  test(`від'ємне значення ${field} повертає 400`, async () => {
    const { app } = createApp();

    const response = await sendDraftRequest(app, {
      day_of_week: 1,
      items: [{ ...validItem, [field]: -1 }],
    });

    assert.equal(response.status, 400);
  });

  test(`дробове значення ${field} повертає 400`, async () => {
    const { app } = createApp();

    const response = await sendDraftRequest(app, {
      day_of_week: 1,
      items: [{ ...validItem, [field]: 1.5 }],
    });

    assert.equal(response.status, 400);
  });

  test(`рядкове значення ${field} повертає 400`, async () => {
    const { app } = createApp();

    const response = await sendDraftRequest(app, {
      day_of_week: 1,
      items: [{ ...validItem, [field]: "5" }],
    });

    assert.equal(response.status, 400);
  });
}

// Перевірка передавання даних у сервіс

test("сервіс отримує всі дані запиту без змін", async () => {
  const { app, getReceivedData } = createApp();

  const requestBody = {
    day_of_week: 3,
    items: [
      validItem,
      {
        group_id: 5,
        activity_id: 6,
        teacher_id: 7,
        room_id: 8,
        duration: 60,
      },
    ],
  };

  const response = await sendDraftRequest(app, requestBody);

  assert.equal(response.status, 200);
  assert.deepEqual(getReceivedData(), requestBody);
});


// ==================== GET /schedules FILTERS ====================

async function sendSchedulesRequest(token, query = {}) {
  const { app, getScheduleQueries } = createApp();

  const response = await request(app)
    .get("/api/schedules")
    .set("Authorization", `Bearer ${token}`)
    .query(query);

  return {
    response,
    queries: getScheduleQueries(),
  };
}

// Перевірка кожного фільтра окремо.

for (const [field, value] of [
  ["day_of_week", "1"],
  ["group_id", "10"],
  ["teacher_id", "3"],
  ["room_id", "2"],
  ["activity_id", "4"],
]) {
  test(`ADMIN може фільтрувати розклад за ${field}`, async () => {
    const { response, queries } = await sendSchedulesRequest(
      "admin",
      { [field]: value }
    );

    assert.equal(response.status, 200);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].where[field], Number(value));
  });
}

// Комбінація фільтрів.

test("ADMIN може одночасно застосувати декілька фільтрів", async () => {
  const filters = {
    day_of_week: "2",
    group_id: "10",
    teacher_id: "3",
    room_id: "4",
    activity_id: "5",
  };

  const { response, queries } = await sendSchedulesRequest(
    "admin",
    filters
  );

  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {
    day_of_week: 2,
    group_id: 10,
    teacher_id: 3,
    room_id: 4,
    activity_id: 5,
  });
});

// Некоректні значення фільтрів.

for (const [field, value] of [
  ["day_of_week", "0"],
  ["day_of_week", "8"],
  ["day_of_week", "1.5"],
  ["day_of_week", "abc"],
  ["group_id", "0"],
  ["group_id", "-1"],
  ["group_id", "abc"],
  ["teacher_id", "1.5"],
  ["room_id", "0"],
  ["activity_id", "abc"],
]) {
  test(`некоректний фільтр ${field}=${value} повертає 400`, async () => {
    const { response, queries } = await sendSchedulesRequest(
      "admin",
      { [field]: value }
    );

    assert.equal(response.status, 400);
    assert.equal(queries.length, 0);
  });
}

// Доступ ADMIN та MANAGER.

test("ADMIN може переглядати розклад без фільтрів", async () => {
  const { response, queries } = await sendSchedulesRequest("admin");

  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {});
});

test("MANAGER може переглядати розклад із фільтрами", async () => {
  const { response, queries } = await sendSchedulesRequest(
    "manager",
    { day_of_week: "3", group_id: "10" }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {
    day_of_week: 3,
    group_id: 10,
  });
});

// Обмеження доступу PARENT.

test("PARENT бачить розклад тільки груп своїх дітей", async () => {
  const { response, queries } = await sendSchedulesRequest("parent");

  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where.group_id, {
    in: [10, 11],
  });
});

test("PARENT може застосувати додатковий фільтр до своїх груп", async () => {
  const { response, queries } = await sendSchedulesRequest(
    "parent",
    { group_id: "10", day_of_week: "2" }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {
    group_id: {
      in: [10, 11],
      equals: 10,
    },
    day_of_week: 2,
  });
});

// Обмеження доступу TEACHER.

test("TEACHER бачить тільки власні заняття", async () => {
  const { response, queries } = await sendSchedulesRequest("teacher");

  assert.equal(response.status, 200);
  assert.equal(queries[0].where.teacher_id, 3);
});

test("TEACHER не може переглядати заняття іншого викладача через фільтр", async () => {
  const { response, queries } = await sendSchedulesRequest(
    "teacher",
    { teacher_id: "99", group_id: "10" }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {
    teacher_id: 3,
    group_id: 10,
  });
});
