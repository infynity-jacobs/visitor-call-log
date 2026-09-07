// Integration tests for the Visitor Register & Call Log API.
//
// These tests spawn the actual backend (app/backend/src/server.js) as a child
// process against a real PostgreSQL database, then exercise the HTTP API the
// same way a browser would. This catches wiring bugs that unit tests miss
// (routing, middleware order, real SQL, real bcrypt/JWT).
//
// Requirements to run:
//   - A reachable PostgreSQL instance with the schema already migrated
//     (see database/migrations/ and deploy/migrate.sh) and the default
//     seeded admin user (username "admin", password "admin123").
//   - Environment variables below (or a .env in app/backend) pointing at it.
//     Defaults match config/.env.example for local development.
//
// Run with: npm test   (from app/backend), or directly:
//   node --test tests/integration/*.test.js

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = process.env.TEST_PORT || '3099';
const BASE_URL = `http://localhost:${PORT}`;
const BACKEND_DIR = path.join(__dirname, '..', '..', 'app', 'backend');

let serverProcess;
let adminToken;

function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.db === true) return resolve();
        }
      } catch (_) {
        // server not up yet
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Server did not become healthy in time'));
      }
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

before(async () => {
  serverProcess = spawn('node', ['src/server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '5432',
      DB_NAME: process.env.DB_NAME || 'visitor_call_log',
      DB_USER: process.env.DB_USER || 'vcl_app',
      DB_PASSWORD: process.env.DB_PASSWORD || 'devpassword',
      JWT_SECRET: 'integration-test-secret',
      APP_SECRET_KEY: 'integration-test-secret-32-bytes!',
      CORS_ORIGIN: '*'
    },
    stdio: 'pipe'
  });

  serverProcess.stderr.on('data', (chunk) => {
    // Surface server errors to help diagnose a failed startup.
    process.stderr.write(`[server] ${chunk}`);
  });

  await waitForHealth();

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.equal(loginRes.status, 200, 'expected default admin login to succeed');
  const loginData = await loginRes.json();
  adminToken = loginData.token;
  assert.ok(adminToken, 'expected a JWT token from login');
});

after(() => {
  if (serverProcess) serverProcess.kill();
});

function authHeaders() {
  return { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
}

test('health check reports ok and db connected', async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.db, true);
});

test('login rejects wrong password', async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
  });
  assert.equal(res.status, 401);
});

test('unauthenticated request to a protected route is rejected', async () => {
  const res = await fetch(`${BASE_URL}/api/visitors`);
  assert.equal(res.status, 401);
});

test('visitor options endpoint returns the seeded defaults', async () => {
  const res = await fetch(`${BASE_URL}/api/visitors/options/all`, { headers: authHeaders() });
  assert.equal(res.status, 200);
  const data = await res.json();
  const purposeLabels = data.purposeOptions.map((o) => o.label);
  for (const expected of ['Bill Pay', 'Enquiry', 'Complaint', 'Purchase', 'Meeting', 'Interview', 'Donation', 'Other']) {
    assert.ok(purposeLabels.includes(expected), `expected purpose options to include ${expected}`);
  }
});

test('creating a visitor with Meeting purpose requires Person to Visit', async () => {
  const res = await fetch(`${BASE_URL}/api/visitors`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: 'Missing Person Field', purpose: 'Meeting' })
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Person to Visit/);
});

test('creating a valid visitor succeeds and is retrievable', async () => {
  const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const createRes = await fetch(`${BASE_URL}/api/visitors`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: 'Integration Test Visitor', place: 'Test City', phone: '5551234567',
      purpose: 'Meeting', personToVisit: 'Jacob', idempotencyKey
    })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.duplicate, false);
  assert.equal(created.record.name, 'Integration Test Visitor');

  // Re-submitting the same idempotency key must not create a duplicate.
  const dupRes = await fetch(`${BASE_URL}/api/visitors`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: 'Integration Test Visitor', place: 'Test City', phone: '5551234567',
      purpose: 'Meeting', personToVisit: 'Jacob', idempotencyKey
    })
  });
  assert.equal(dupRes.status, 200);
  const dup = await dupRes.json();
  assert.equal(dup.duplicate, true);
  assert.equal(dup.record.id, created.record.id);

  const listRes = await fetch(`${BASE_URL}/api/visitors?mode=all&limit=500`, { headers: authHeaders() });
  const list = await listRes.json();
  assert.ok(list.records.some((r) => r.id === created.record.id));
});

test('creating a call log entry succeeds', async () => {
  const res = await fetch(`${BASE_URL}/api/calllog`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: 'Test Caller', place: 'Test City', phone: '5559998888', reason: 'Integration test call' })
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.record.name, 'Test Caller');
});

test('visitors report can be generated as xlsx and pdf', async () => {
  const xlsxRes = await fetch(`${BASE_URL}/api/reports/visitors/xlsx`, { headers: authHeaders() });
  assert.equal(xlsxRes.status, 200);
  assert.equal(xlsxRes.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const pdfRes = await fetch(`${BASE_URL}/api/reports/visitors/pdf`, { headers: authHeaders() });
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
});

test('non-admin cannot manage purpose options', async () => {
  // Create a normal user, log in as them, and confirm write access is denied.
  const username = `normaluser${Date.now()}`;
  const createUserRes = await fetch(`${BASE_URL}/api/settings/users`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, password: 'password123', role: 'user' })
  });
  assert.equal(createUserRes.status, 201);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' })
  });
  const { token } = await loginRes.json();

  const addOptionRes = await fetch(`${BASE_URL}/api/settings/purpose-options`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'Should Not Be Allowed' })
  });
  assert.equal(addOptionRes.status, 403);
});

test('branding settings can be read and updated by an admin', async () => {
  const updateRes = await fetch(`${BASE_URL}/api/settings/branding`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ orgName: 'Integration Test Org', reportHeader: 'Test Header' })
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.branding.org_name, 'Integration Test Org');

  const getRes = await fetch(`${BASE_URL}/api/settings/branding`, { headers: authHeaders() });
  const fetched = await getRes.json();
  assert.equal(fetched.branding.org_name, 'Integration Test Org');
});


test('call log requires place and phone', async () => {
  const missingPlace = await fetch(`${BASE_URL}/api/calllog`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ name: 'Required Field Test', phone: '5551234567', reason: 'Test' })
  });
  assert.equal(missingPlace.status, 400);
  const missingPhone = await fetch(`${BASE_URL}/api/calllog`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ name: 'Required Field Test', place: 'Test City', reason: 'Test' })
  });
  assert.equal(missingPhone.status, 400);
});

test('global search returns visitor and call log matches', async () => {
  const visitor = await fetch(`${BASE_URL}/api/search?q=Integration%20Test%20Visitor`, { headers: authHeaders() });
  assert.equal(visitor.status, 200);
  const visitorData = await visitor.json();
  assert.ok(visitorData.results.some((r) => r.type === 'visitor'));

  const call = await fetch(`${BASE_URL}/api/search?q=Integration%20test%20call`, { headers: authHeaders() });
  assert.equal(call.status, 200);
  const callData = await call.json();
  assert.ok(callData.results.some((r) => r.type === 'calllog'));
});

test('user delete preserves historical visitor and call log records', async () => {
  const username = `deleteuser${Date.now()}`;
  const createUserRes = await fetch(`${BASE_URL}/api/settings/users`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ username, password: 'password123', fullName: 'Delete User', role: 'user' })
  });
  assert.equal(createUserRes.status, 201);
  const user = (await createUserRes.json()).user;

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' })
  });
  assert.equal(loginRes.status, 200);
  const userToken = (await loginRes.json()).token;
  const userHeaders = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };

  const visitorRes = await fetch(`${BASE_URL}/api/visitors`, {
    method: 'POST', headers: userHeaders,
    body: JSON.stringify({ name: 'Delete User Visitor', purpose: 'Other', otherDetails: 'Delete test', idempotencyKey: `del-v-${Date.now()}` })
  });
  assert.equal(visitorRes.status, 201);

  const callRes = await fetch(`${BASE_URL}/api/calllog`, {
    method: 'POST', headers: userHeaders,
    body: JSON.stringify({ name: 'Delete User Caller', place: 'Test City', phone: '5551112222', reason: 'Delete test', idempotencyKey: `del-c-${Date.now()}` })
  });
  assert.equal(callRes.status, 201);

  const deleteRes = await fetch(`${BASE_URL}/api/settings/users/${user.id}`, { method: 'DELETE', headers: authHeaders() });
  assert.equal(deleteRes.status, 200);

  const listRes = await fetch(`${BASE_URL}/api/visitors?mode=all&limit=500`, { headers: authHeaders() });
  const list = await listRes.json();
  assert.ok(list.records.some((r) => r.name === 'Delete User Visitor'));

  const callsRes = await fetch(`${BASE_URL}/api/calllog?mode=all&limit=500`, { headers: authHeaders() });
  const calls = await callsRes.json();
  assert.ok(calls.records.some((r) => r.name === 'Delete User Caller'));
});
