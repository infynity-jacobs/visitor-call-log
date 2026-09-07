const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  requireString, validatePhone, validateEmail, validateDate, validateTime, validatePagination, validateDateFilter
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

test('validateDate: rejects impossible calendar dates', () => {
  assert.throws(() => validateDate('2026-02-30', 'Date', { optional: false }), /valid calendar date/);
  assert.throws(() => validateDate('2026-99-99', 'Date', { optional: false }), /valid calendar date/);
});

test('validateTime: rejects impossible clock times', () => {
  assert.throws(() => validateTime('24:00', 'Time', { optional: false }), /invalid time/);
  assert.throws(() => validateTime('12:60', 'Time', { optional: false }), /invalid time/);
});

test('validatePagination: rejects invalid values and accepts bounds', () => {
  assert.equal(validatePagination(undefined, 'Limit', { defaultValue: 500, min: 1, max: 1000 }), 500);
  assert.equal(validatePagination('25', 'Limit', { defaultValue: 500, min: 1, max: 1000 }), 25);
  assert.throws(() => validatePagination('abc', 'Limit', { min: 1, max: 1000 }), /integer/);
  assert.throws(() => validatePagination('0', 'Limit', { min: 1, max: 1000 }), /between/);
});

test('validateDateFilter: validates modes and ranges', () => {
  assert.deepEqual(validateDateFilter({ mode: 'single', date: '2026-09-07' }), { mode: 'single', date: '2026-09-07' });
  assert.throws(() => validateDateFilter({ mode: 'bad' }), /one of/);
  assert.throws(() => validateDateFilter({ mode: 'range', startDate: '2026-09-08', endDate: '2026-09-07' }), /later/);
});
