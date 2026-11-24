
const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function createMocks(overrides = {}) {
  const prisma = {
    groups: {
      findMany: async () => [{ id: 1 }],
    },

    rooms: {
      findMany: async () => [{ id: 1 }, { id: 2 }],
    },

    schedules: {
      findMany: async () => [],
      create: async () => {
        throw new Error('Draft must not be saved');
      },
      update: async () => {
        throw new Error('Draft must not be updated');
      },
    },

    teacher_activities: {
      findUnique: async () => ({
        employee_id: 2,
        activity_id: 1,
      }),
    },

    ...overrides,
  };

  const service = proxyquire(
    '../src/services/schedule.service',
    {
      '../config/prisma': prisma,
    }
  );

  return { prisma, service };
}

function createScenario(overrides = {}) {
  return {
    scenarioId: 'scenario-2026-12-a',
    variantId: 'variant-2-groups',

    groups: [
      {
        scenarioGroupId: 'group-1',
        sourceGroupId: 1,
        childrenCount: 14,
        capacity: 20,
        target_age: 3,
      },
      {
        scenarioGroupId: 'group-2',
        childrenCount: 13,
        capacity: 20,
        target_age: 4,
      },
    ],

    items: [
      {
        scenarioGroupId: 'group-1',
        activity_id: 1,
        teacher_id: 2,
        room_id: 1,
        day_of_week: 1,
        duration: 45,
      },
      {
        scenarioGroupId: 'group-2',
        activity_id: 1,
        teacher_id: 2,
        room_id: 2,
        day_of_week: 2,
        duration: 30,
      },
    ],

    ...overrides,
  };
}

test('generates a weekly draft for a valid scenario', async () => {
  const { service } = createMocks();

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  assert.equal(result.isFeasible, true);
  assert.equal(result.scenarioId, 'scenario-2026-12-a');
  assert.equal(result.variantId, 'variant-2-groups');
  assert.equal(result.draft.length, 2);
  assert.equal(result.errors.length, 0);
});

test('returns scenario group composition', async () => {
  const { service } = createMocks();

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  assert.equal(result.groupComposition.length, 2);
  assert.equal(
    result.groupComposition[0].scenarioGroupId,
    'group-1'
  );
  assert.equal(
    result.groupComposition[0].childrenCount,
    14
  );
});

test('rejects invalid scenario group capacity', async () => {
  const { service } = createMocks();

  const scenario = createScenario({
    groups: [
      {
        scenarioGroupId: 'group-1',
        childrenCount: 25,
        capacity: 20,
      },
    ],
  });

  await assert.rejects(
    () => service.generateDraftSchedule(scenario),
    /місткість групи/
  );
});

test('rejects missing scenarioId', async () => {
  const { service } = createMocks();

  await assert.rejects(
    () =>
      service.generateDraftSchedule(
        createScenario({ scenarioId: '' })
      ),
    error => error.status === 400 && /scenarioId/.test(error.message)
  );
});

test('rejects missing variantId with a bad request error', async () => {
  const { service } = createMocks();

  await assert.rejects(
    () =>
      service.generateDraftSchedule(
        createScenario({ variantId: '' })
      ),
    error => error.status === 400 && /variantId/.test(error.message)
  );
});

test('rejects malformed scenarioGroupId with a bad request error', async () => {
  const { service } = createMocks();

  const scenario = createScenario({
    groups: [
      {
        scenarioGroupId: '',
        childrenCount: 14,
        capacity: 20,
      },
    ],
  });

  await assert.rejects(
    () => service.generateDraftSchedule(scenario),
    error => error.status === 400 && /scenarioGroupId/.test(error.message)
  );
});

test('rejects malformed group and lesson entries with a bad request error', async () => {
  const { service } = createMocks();

  await assert.rejects(
    () => service.generateDraftSchedule(createScenario({ groups: [null] })),
    error => error.status === 400 && /сценарна група/.test(error.message)
  );

  await assert.rejects(
    () => service.generateDraftSchedule(createScenario({ items: [null] })),
    error => error.status === 400 && /заняття/.test(error.message)
  );
});

test('rejects an unknown scenario group with a bad request error', async () => {
  const { service } = createMocks();

  const scenario = createScenario({
    items: [
      {
        scenarioGroupId: 'unknown-group',
        activity_id: 1,
        teacher_id: 2,
        room_id: 1,
        day_of_week: 1,
        duration: 30,
      },
    ],
  });

  await assert.rejects(
    () => service.generateDraftSchedule(scenario),
    error => error.status === 400 && /невідому сценарну групу/.test(error.message)
  );
});

test('rejects an invalid duration', async () => {
  const { service } = createMocks();

  const scenario = createScenario({
    items: [
      {
        scenarioGroupId: 'group-1',
        activity_id: 1,
        teacher_id: 2,
        room_id: 1,
        day_of_week: 1,
        duration: -30,
      },
    ],
  });

  const result = await service.generateDraftSchedule(scenario);

  assert.equal(result.isFeasible, false);
  assert.match(result.errors[0].reason, /додатним цілим числом/);
});

test('returns an error when teacher is not qualified', async () => {
  const { service } = createMocks({
    teacher_activities: {
      findUnique: async () => null,
    },
  });

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  assert.equal(result.isFeasible, false);
  assert.equal(result.draft.length, 0);
  assert.match(result.errors[0].reason, /кваліфікації/);
});

test('rejects a room that does not exist', async () => {
  const { service } = createMocks({
    rooms: {
      findMany: async () => [],
    },
  });

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  assert.equal(result.isFeasible, false);
  assert.match(result.errors[0].reason, /кімната не існує/);
});

test('does not schedule lessons during reserved slots', async () => {
  const { service } = createMocks();

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  for (const item of result.draft) {
    const start = service.timeToMinutes(item.formatted_start);
    const end = service.timeToMinutes(item.formatted_end);

    assert.equal(service.isReservedSlot(start, end), false);
  }
});

test('does not overlap with an existing database schedule', async () => {
  const { service } = createMocks({
    schedules: {
      findMany: async () => [
        {
          id: 100,
          group_id: 1,
          teacher_id: 2,
          room_id: 1,
          day_of_week: 1,
          start_time: new Date('1970-01-01T09:30:00Z'),
          end_time: new Date('1970-01-01T10:15:00Z'),
        },
      ],
    },
  });

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  const mondayLesson = result.draft.find(
    item => item.day_of_week === 1
  );

  assert.ok(mondayLesson);

  const start = service.timeToMinutes(
    mondayLesson.formatted_start
  );

  const end = service.timeToMinutes(
    mondayLesson.formatted_end
  );

  assert.equal(
    start < 10 * 60 + 15 && end > 9 * 60 + 30,
    false
  );
});

test('reports when no slot is available', async () => {
  const { service } = createMocks();

  const scenario = createScenario({
    items: [
      {
        scenarioGroupId: 'group-1',
        activity_id: 1,
        teacher_id: 2,
        room_id: 1,
        day_of_week: 1,
        duration: 481,
      },
    ],
  });

  const result = await service.generateDraftSchedule(scenario);

  assert.equal(result.isFeasible, false);
  assert.equal(result.draft.length, 0);
  assert.equal(result.errors.length, 1);
});

test('does not persist the generated draft', async () => {
  let writeOperations = 0;

  const { service } = createMocks({
    schedules: {
      findMany: async () => [],
      create: async () => {
        writeOperations++;
      },
      update: async () => {
        writeOperations++;
      },
    },
  });

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  assert.equal(result.persisted, false);
  assert.equal(writeOperations, 0);
});

test('preserves scenarioId and variantId in every draft item', async () => {
  const { service } = createMocks();

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  for (const item of result.draft) {
    assert.equal(item.scenarioId, result.scenarioId);
    assert.equal(item.variantId, result.variantId);
  }
});

test('returns correct scheduling summary', async () => {
  const { service } = createMocks();

  const result = await service.generateDraftSchedule(
    createScenario()
  );

  assert.equal(result.summary.totalItems, 2);
  assert.equal(result.summary.scheduledItems, 2);
  assert.equal(result.summary.unscheduledItems, 0);
});
