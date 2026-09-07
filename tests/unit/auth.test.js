const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_SECRET_KEY = 'test-secret-key-for-unit-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_PASSWORD = 'unused-in-this-test';

const auth = require('../../app/backend/src/middleware/auth');

test('auth middleware exports Super Administrator guard', () => {
  assert.equal(typeof auth.authenticate, 'function');
  assert.equal(typeof auth.requireAdmin, 'function');
  assert.equal(typeof auth.requireSuperAdmin, 'function');
});

test('requireSuperAdmin rejects non-super-admin users', () => {
  const req = { user: { role: 'admin' } };
  let nextCalled = false;
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  auth.requireSuperAdmin(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Super Administrator access required.');
  assert.equal(nextCalled, false);
});

test('requireSuperAdmin allows super-admin users', () => {
  const req = { user: { role: 'super_admin' } };
  const res = { status() { throw new Error('should not reject'); }, json() { throw new Error('should not reject'); } };
  let nextCalled = false;
  auth.requireSuperAdmin(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
