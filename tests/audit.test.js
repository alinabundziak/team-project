
const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function loadAuditService(logs = [], total = 0) {
  const repository = {
    findMany: async () => logs,
    count: async () => total,
  };

  return proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });
}

test("повертає порожній журнал з правильною пагінацією", async () => {
  const service = loadAuditService();

  const result = await service.listAuditLogs({});

  assert.deepEqual(result, {
    data: [],
    meta: {
      page: 1,
      limit: 20,
      total: 0,
    },
  });
});

test("фільтрує журнал за операцією UPDATE", async () => {
  let receivedOptions;

  const repository = {
    findMany: async (options) => {
      receivedOptions = options;
      return [];
    },
    count: async () => 0,
  };

  const service = proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });

  const result = await service.listAuditLogs({
    operation: "UPDATE",
  });

  assert.equal(receivedOptions.where.operation, "UPDATE");
  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
});

test("правильно обчислює пагінацію для другої сторінки", async () => {
  let receivedOptions;

  const repository = {
    findMany: async (options) => {
      receivedOptions = options;
      return [];
    },
    count: async () => 45,
  };

  const service = proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });

  const result = await service.listAuditLogs({
    page: "2",
    limit: "10",
  });

  assert.equal(receivedOptions.skip, 10);
  assert.equal(receivedOptions.take, 10);

  assert.deepEqual(result.meta, {
    page: 2,
    limit: 10,
    total: 45,
  });
});

test("відхиляє некоректну операцію", async () => {
  const service = loadAuditService();

  await assert.rejects(
    () => service.listAuditLogs({ operation: "INVALID" }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    }
  );
});

test("відхиляє недозволену назву таблиці", async () => {
  const service = loadAuditService();

  await assert.rejects(
    () => service.listAuditLogs({
      tableName: "public.unknown_table",
    }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    }
  );
});

test("відхиляє діапазон дат, де from пізніше за to", async () => {
  const service = loadAuditService();

  await assert.rejects(
    () => service.listAuditLogs({
      from: "2026-11-10",
      to: "2026-11-05",
    }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    }
  );
});

test("відхиляє некоректний формат дати", async () => {
  const service = loadAuditService();

  await assert.rejects(
    () => service.listAuditLogs({ from: "10-11-2026" }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    }
  );
});

test("відхиляє некоректні параметри пагінації", async () => {
  const service = loadAuditService();

  const invalidQueries = [
    { page: "0" },
    { page: "-1" },
    { page: "abc" },
    { limit: "0" },
    { limit: "-5" },
    { limit: "abc" },
    { limit: "101" },
  ];

  for (const query of invalidQueries) {
    await assert.rejects(
      () => service.listAuditLogs(query),
      (error) => {
        assert.equal(error.status, 400);
        return true;
      },
      `Очікувалася помилка 400 для ${JSON.stringify(query)}`
    );
  }
});

test("фільтрує журнал за назвою таблиці", async () => {
  let receivedOptions;

  const repository = {
    findMany: async (options) => {
      receivedOptions = options;
      return [];
    },
    count: async () => 0,
  };

  const service = proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });

  const result = await service.listAuditLogs({
    tableName: "public.children",
  });

  assert.equal(receivedOptions.where.table_name, "public.children");
  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
});

test("правильно перетворює запис аудиту в DTO", async () => {
  const auditRecord = {
    id: 1,
    table_name: "public.children",
    record_key: { child_id: 5, group_id: 2 },
    operation: "UPDATE",
    old_data: { group_id: 1 },
    new_data: { group_id: 2 },
    changed_columns: ["group_id"],
    db_user: "postgres",
    changed_at: new Date("2026-11-05T12:00:00.000Z"),
  };

  const service = loadAuditService([auditRecord], 1);

  const result = await service.listAuditLogs({});

  assert.deepEqual(result.data, [{
    id: 1,
    tableName: "public.children",
    recordKey: { child_id: 5, group_id: 2 },
    operation: "UPDATE",
    oldData: { group_id: 1 },
    newData: { group_id: 2 },
    changedColumns: ["group_id"],
    databaseUser: "postgres",
    changedAt: "2026-11-05T12:00:00.000Z",
  }]);

  assert.deepEqual(result.meta, {
    page: 1,
    limit: 20,
    total: 1,
  });
});

test("залишає oldData та newData рівними null у DTO", async () => {
  const auditRecord = {
    id: 2,
    table_name: "public.children",
    record_key: { child_id: 5 },
    operation: "INSERT",
    old_data: null,
    new_data: null,
    changed_columns: [],
    db_user: "postgres",
    changed_at: new Date("2026-11-05T12:00:00.000Z"),
  };

  const service = loadAuditService([auditRecord], 1);

  const result = await service.listAuditLogs({});

  assert.equal(result.data[0].oldData, null);
  assert.equal(result.data[0].newData, null);
});

test("правильно формує фільтр за діапазоном дат", async () => {
  let receivedOptions;

  const repository = {
    findMany: async (options) => {
      receivedOptions = options;
      return [];
    },
    count: async () => 0,
  };

  const service = proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });

  await service.listAuditLogs({
    from: "2026-11-01",
    to: "2026-11-05",
  });

  assert.deepEqual(receivedOptions.where.changed_at, {
    gte: new Date("2026-11-01T00:00:00.000Z"),
    lt: new Date("2026-11-06T00:00:00.000Z"),
  });
});

test("Repository сортує журнал за датою та ID у спадному порядку", async () => {
  let receivedOptions;

  const prismaMock = {
    audit_logs: {
      findMany: async (options) => {
        receivedOptions = options;
        return [];
      },
    },
  };

  const repository = proxyquire("../src/modules/audit/audit.repository.js", {
    "../../config/prisma": prismaMock,
  });

  await repository.findMany({
    where: {},
    skip: 0,
    take: 20,
  });

  assert.deepEqual(receivedOptions.orderBy, [
    { changed_at: "desc" },
    { id: "desc" },
  ]);

  assert.equal(receivedOptions.skip, 0);
  assert.equal(receivedOptions.take, 20);
});

test("відхиляє неіснуючі календарні дати", async () => {
  const service = loadAuditService();

  for (const date of ["2026-02-30", "2026-13-01", "2026-11-31"]) {
    await assert.rejects(
      () => service.listAuditLogs({ from: date }),
      (error) => {
        assert.equal(error.status, 400);
        return true;
      }
    );
  }
});

test("відхиляє надто довгу назву таблиці", async () => {
  const service = loadAuditService();

  await assert.rejects(
    () => service.listAuditLogs({
      tableName: "public." + "a".repeat(300),
    }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    }
  );
});

test("приймає максимальний limit 100", async () => {
  let receivedOptions;

  const repository = {
    findMany: async (options) => {
      receivedOptions = options;
      return [];
    },
    count: async () => 150,
  };

  const service = proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });

  const result = await service.listAuditLogs({
    page: "1",
    limit: "100",
  });

  assert.equal(receivedOptions.skip, 0);
  assert.equal(receivedOptions.take, 100);
  assert.deepEqual(result.meta, {
    page: 1,
    limit: 100,
    total: 150,
  });
});

test("підтримує одночасне використання кількох фільтрів", async () => {
  let receivedOptions;

  const repository = {
    findMany: async (options) => {
      receivedOptions = options;
      return [];
    },
    count: async () => 0,
  };

  const service = proxyquire("../src/modules/audit/audit.service.js", {
    "./audit.repository": repository,
  });

  await service.listAuditLogs({
    tableName: "public.children",
    operation: "DELETE",
    from: "2026-11-01",
    to: "2026-11-05",
    page: "2",
    limit: "5",
  });

  assert.equal(receivedOptions.where.table_name, "public.children");
  assert.equal(receivedOptions.where.operation, "DELETE");

  assert.deepEqual(receivedOptions.where.changed_at, {
    gte: new Date("2026-11-01T00:00:00.000Z"),
    lt: new Date("2026-11-06T00:00:00.000Z"),
  });

  assert.equal(receivedOptions.skip, 5);
  assert.equal(receivedOptions.take, 5);
});

test("передає кожну дозволену операцію в where.operation", async () => {
  const operations = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];

  for (const operation of operations) {
    let receivedOptions;

    const repository = {
      findMany: async (options) => {
        receivedOptions = options;
        return [];
      },
      count: async () => 0,
    };

    const service = proxyquire("../src/modules/audit/audit.service.js", {
      "./audit.repository": repository,
    });

    await service.listAuditLogs({ operation });

    assert.ok(receivedOptions, "Repository.findMany має бути викликаний");
    assert.equal(
      receivedOptions.where.operation,
      operation,
      `Операція ${operation} має передаватися в where.operation`
    );
  }
});

test("Repository правильно передає умови до Prisma count", async () => {
  let receivedWhere;

  const prismaMock = {
    audit_logs: {
      count: async (options) => {
        receivedWhere = options.where;
        return 7;
      },
    },
  };

  const repository = proxyquire("../src/modules/audit/audit.repository.js", {
    "../../config/prisma": prismaMock,
  });

  const where = {
    table_name: "public.children",
    operation: "UPDATE",
  };

  const total = await repository.count(where);

  assert.equal(total, 7);
  assert.deepEqual(receivedWhere, where);
});

test("Repository повертає записи, отримані від Prisma", async () => {
  const records = [
    { id: 3, operation: "INSERT" },
    { id: 2, operation: "UPDATE" },
  ];

  const prismaMock = {
    audit_logs: {
      findMany: async () => records,
    },
  };

  const repository = proxyquire("../src/modules/audit/audit.repository.js", {
    "../../config/prisma": prismaMock,
  });

  const result = await repository.findMany({
    where: {},
    skip: 0,
    take: 20,
  });

  assert.deepEqual(result, records);
});

test("Service не змінює замасковані дані журналу", async () => {
  const auditRecord = {
    id: 10,
    table_name: "public.users",
    record_key: { id: 5 },
    operation: "UPDATE",
    old_data: {
      email: "old@example.com",
      password_hash: "***",
    },
    new_data: {
      email: "new@example.com",
      password_hash: "***",
    },
    changed_columns: ["email"],
    db_user: "postgres",
    changed_at: new Date("2026-11-05T12:00:00.000Z"),
  };

  const service = loadAuditService([auditRecord], 1);

  const result = await service.listAuditLogs({});

  assert.equal(result.data[0].oldData.password_hash, "***");
  assert.equal(result.data[0].newData.password_hash, "***");

  assert.notEqual(
    result.data[0].oldData.password_hash,
    "real-secret-hash"
  );
});
