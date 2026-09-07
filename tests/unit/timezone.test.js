const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatIstDateTime, utcBoundsForIstDate, nextIstDate } = require('../../app/backend/src/utils/timezone');

test('formatIstDateTime converts UTC storage to IST', () => {
  assert.equal(formatIstDateTime('2026-09-07', '00:00:00'), '2026-09-07 05:30:00');
  assert.equal(formatIstDateTime('2026-09-07', '20:00:00'), '2026-09-08 01:30:00');
});

test('IST date boundaries convert to UTC correctly', () => {
  assert.deepEqual(utcBoundsForIstDate('2026-09-07'), { date: '2026-09-06', time: '18:30:00' });
  assert.equal(nextIstDate('2026-09-07'), '2026-09-08');
});
