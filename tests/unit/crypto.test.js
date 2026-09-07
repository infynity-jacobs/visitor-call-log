const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_SECRET_KEY = 'test-secret-key-for-unit-tests-only';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_PASSWORD = 'unused-in-this-test';

const { encrypt, decrypt } = require('../../app/backend/src/utils/crypto');

test('encrypt/decrypt: round-trips a plaintext password', () => {
  const plain = 'my-smtp-password-123!';
  const encrypted = encrypt(plain);
  assert.notEqual(encrypted, plain);
  assert.equal(decrypt(encrypted), plain);
});

test('encrypt: returns null for empty input', () => {
  assert.equal(encrypt(''), null);
  assert.equal(encrypt(null), null);
  assert.equal(encrypt(undefined), null);
});

test('encrypt: produces different ciphertext each call (random IV)', () => {
  const a = encrypt('same-password');
  const b = encrypt('same-password');
  assert.notEqual(a, b);
  assert.equal(decrypt(a), 'same-password');
  assert.equal(decrypt(b), 'same-password');
});
