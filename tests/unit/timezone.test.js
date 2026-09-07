const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatIstDateTime, utcBoundsForIstDate, nextIstDate } = require('../../app/backend/src/utils/timezone');

test('formatIstDateTime converts PostgreSQL string values from UTC storage to IST', () => {
  assert.equal(formatIstDateTime('2026-09-07', '00:00:00'), '2026-09-07 05:30:00');
  assert.equal(formatIstDateTime('2026-09-07', '20:00:00'), '2026-09-08 01:30:00');
});

test('formatIstDateTime handles Date objects and PostgreSQL-like timestamp text', () => {
  assert.equal(formatIstDateTime(new Date('2026-09-07T00:00:00Z'), '20:15:30'), '2026-09-08 01:45:30');
  assert.equal(formatIstDateTime('2026-09-07T00:00:00.000Z', '00:05:06'), '2026-09-07 05:35:06');
});

test('formatIstDateTime returns empty output for invalid values instead of NaN', () => {
  assert.equal(formatIstDateTime('not-a-date', '12:00:00'), '');
  assert.equal(formatIstDateTime('2026-09-07', 'not-a-time'), '');
});

test('IST date boundaries convert to UTC correctly', () => {
  assert.deepEqual(utcBoundsForIstDate('2026-09-07'), { date: '2026-09-06', time: '18:30:00' });
  assert.equal(nextIstDate('2026-09-07'), '2026-09-08');
});

test('formatIstDateTime handles Date and time objects without NaN', () => {
  const { formatIstDateTime } = require('../../app/backend/src/utils/timezone');
  assert.equal(formatIstDateTime(new Date(Date.UTC(2024,11,17)), '10:04:00'), '2024-12-17 15:34:00');
});
