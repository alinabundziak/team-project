
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noCallThru();

function createApp() {
  let receivedData = null;

  const authModule = {
    authenticate(req, res, next) {
      const token = req.headers.authorization;

      if (token === "Bearer admin") {
        req.user = { id: 1, role: "ADMIN" };
      } else if (token === "Bearer manager") {
        req.user = { id: 2, role: "MANAGER" };
      } else if (token === "Bearer teacher") {
        req.user = { id: 3, role: "TEACHER" };
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

  const scheduleRouter = proxyquire("../src/routes/schedule.router.js", {
    "../config/prisma": {},
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
