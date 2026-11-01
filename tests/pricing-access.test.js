const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

test('Pricing: забороняє доступ до чужої дитини для обох розрахунків', async () => {
  const calls = [];
  const denied = Object.assign(new Error('Access denied'), { status: 403 });

  const service = proxyquire('../src/modules/pricing/pricing.service', {
    '../children/children.access': {
      assertChildAccess: async (user, childId) => {
        calls.push({ user, childId });
        throw denied;
      }
    },
    '../children/children.repository': {},
    '../discounts/discounts.repository': {},
    '../discounts/discounts.service': {
      isSupportedPercent: () => true
    },
    './pricing.repository': {},
    '../tariffs/tariffs.service': {}
  });

  const user = { id: 2, role: 'PARENT' };

  for (const method of ['estimateTuition', 'estimateMeals']) {
    await assert.rejects(
      service[method]('1', {}, user),
      { status: 403 }
    );
  }

  assert.equal(calls.length, 2);
  assert.deepEqual(calls, [
    { user, childId: 1 },
    { user, childId: 1 }
  ]);
});
