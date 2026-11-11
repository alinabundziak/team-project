const test = require('node:test');
const assert = require('node:assert/strict');
const { idParams } = require('../src/middleware/validate');
const { validateLogin } = require('../src/modules/auth/auth.validators');
const { validateCreateUser } = require('../src/modules/users/users.validators');
const c = require('../src/modules/children/children.validators');
const p = require('../src/modules/parents/parents.validators');

const bad = { status: 400 };

test('ID у шляху', () => {
  for (const v of ['abc', '0', '-1', '1.5', '']) {
    assert.throws(() => idParams('id')({ id: v }), bad);
  }
  assert.doesNotThrow(() => idParams('id')({ id: '5' }));
});

test('login: обов\'язкові поля', () => {
  assert.throws(() => validateLogin({}), bad);
  assert.throws(() => validateLogin({ email: 'a@b.com' }), bad);
  assert.doesNotThrow(() => validateLogin({ email: 'a@b.com', password: 'x' }));
});

test('створення користувача', () => {
  const ok = { email: 'a@b.com', password: 'Test12345', role: 'PARENT' };
  assert.doesNotThrow(() => validateCreateUser(ok));
  assert.throws(() => validateCreateUser({ ...ok, email: 'abc' }), bad);
  assert.throws(() => validateCreateUser({ ...ok, password: '123' }), bad);
  assert.throws(() => validateCreateUser({ ...ok, role: 'SUPERADMIN' }), bad);
  assert.throws(() => validateCreateUser({}), bad);
});

test('створення дитини', () => {
  const ok = { firstName: 'Марія', lastName: 'Коваленко', dateOfBirth: '2023-05-10' };
  assert.doesNotThrow(() => c.validateCreateChild(ok));
  assert.doesNotThrow(() => c.validateCreateChild({ ...ok, groupId: null }));
  assert.throws(() => c.validateCreateChild({ ...ok, firstName: '' }), bad);
  assert.throws(() => c.validateCreateChild({ ...ok, lastName: undefined }), bad);
  assert.throws(() => c.validateCreateChild({ ...ok, dateOfBirth: '2024-02-31' }), bad);
  assert.throws(() => c.validateCreateChild({ ...ok, dateOfBirth: '10.05.2023' }), bad);
  assert.throws(() => c.validateCreateChild({ ...ok, groupId: 'abc' }), bad);
  assert.throws(() => c.validateCreateChild({ ...ok, groupId: 0 }), bad);
});

test('оновлення дитини', () => {
  assert.throws(() => c.validateUpdateChild({}), bad);
  assert.doesNotThrow(() => c.validateUpdateChild({ groupId: null }));
  assert.throws(() => c.validateUpdateChild({ dateOfBirth: 'x' }), bad);
});

test('зв\'язок дитина-батько', () => {
  assert.throws(() => c.validateLinkParent({}), bad);
  assert.throws(() => c.validateLinkParent({ parentId: 'abc' }), bad);
  assert.doesNotThrow(() => c.validateLinkParent({ parentId: 3 }));
});

test('створення і оновлення батька', () => {
  const ok = { userId: 2, firstName: 'Олена', lastName: 'Іваненко', phone: '+380 50 123-45-67' };
  assert.doesNotThrow(() => p.validateCreateParent(ok));
  assert.throws(() => p.validateCreateParent({ ...ok, userId: 'abc' }), bad);
  assert.throws(() => p.validateCreateParent({ ...ok, phone: 'abc' }), bad);
  assert.throws(() => p.validateCreateParent({ ...ok, phone: undefined }), bad);
  assert.throws(() => p.validateUpdateParent({}), bad);
  assert.throws(() => p.validateUpdateParent({ userId: 1 }), bad);
  assert.doesNotThrow(() => p.validateUpdateParent({ phone: '0671234567' }));
});

test('parentNote', () => {
  assert.doesNotThrow(() => c.validateParentNote({ parentNote: 'Алергія на цитрусові' }));
  assert.doesNotThrow(() => c.validateParentNote({ parentNote: null }));
  assert.throws(() => c.validateParentNote({}), bad);
  assert.throws(() => c.validateParentNote({ parentNote: 5 }), bad);
  assert.throws(() => c.validateParentNote({ parentNote: 'x'.repeat(501) }), bad);
  assert.equal(c.normalizeParentNote('   '), null);
});