const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  requireString, validatePhone, validateEmail, validateDate, validateTime
} = require('../../app/backend/src/utils/validators');

test('requireString: trims and accepts a normal value', () => {
  assert.equal(requireString('  Ravi  ', 'Name'), 'Ravi');
});

test('requireString: throws when required and empty', () => {
  assert.throws(() => requireString('', 'Name'), /Name is required/);
});

test('requireString: optional empty returns null', () => {
  assert.equal(requireString('', 'Place', { optional: true }), null);
});

test('requireString: enforces max length', () => {
  assert.throws(() => requireString('x'.repeat(300), 'Name', { maxLen: 255 }), /255 characters/);
});

test('validatePhone: accepts a plausible number', () => {
  assert.equal(validatePhone('+1 (555) 123-4567'), '+1 (555) 123-4567');
});

test('validatePhone: rejects letters', () => {
  assert.throws(() => validatePhone('abc123', 'Phone', { optional: false }));
});

test('validateEmail: accepts a valid address', () => {
  assert.equal(validateEmail('test@example.com'), 'test@example.com');
});

test('validateEmail: rejects malformed address', () => {
  assert.throws(() => validateEmail('not-an-email', 'Email', { optional: false }));
});

test('validateDate: accepts ISO date', () => {
  assert.equal(validateDate('2026-01-15'), '2026-01-15');
});

test('validateDate: rejects wrong format', () => {
  assert.throws(() => validateDate('15/01/2026', 'Date', { optional: false }));
});

test('validateTime: accepts HH:MM', () => {
  assert.equal(validateTime('14:30'), '14:30');
});

test('validateTime: rejects garbage', () => {
  assert.throws(() => validateTime('not-a-time', 'Time', { optional: false }));
});
