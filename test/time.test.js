import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, localDay } from '../src/time.js';

test('a local day in Paris, winter and summer', () => {
  const winter = localDay(Date.parse('2026-11-15T23:30:00Z'), 'Europe/Paris');
  assert.equal(winter.key, '2026-11-16');
  assert.equal(new Date(winter.start).toISOString(), '2026-11-15T23:00:00.000Z');
  assert.equal(winter.end - winter.start, 24 * 3600000);
  const summer = localDay(Date.parse('2026-06-21T12:00:00Z'), 'Europe/Paris');
  assert.equal(new Date(summer.start).toISOString(), '2026-06-20T22:00:00.000Z');
});

test('daylight saving days last 23 and 25 hours', () => {
  const spring = localDay(Date.parse('2026-03-29T12:00:00Z'), 'Europe/Paris');
  assert.equal(spring.end - spring.start, 23 * 3600000);
  const autumn = localDay(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Paris');
  assert.equal(autumn.end - autumn.start, 25 * 3600000);
  const toronto = localDay(Date.parse('2026-11-01T12:00:00Z'), 'America/Toronto');
  assert.equal(toronto.end - toronto.start, 25 * 3600000);
});

test('shifted days, across a month end', () => {
  const day = localDay(Date.parse('2026-11-30T12:00:00Z'), 'Europe/Paris', 1);
  assert.equal(day.key, '2026-12-01');
  assert.equal(localDay(Date.parse('2026-01-01T12:00:00Z'), 'UTC', -1).key, '2025-12-31');
});

test('times on a 24-hour clock in every language', () => {
  const at = Date.parse('2026-11-15T16:40:00Z');
  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.equal(formatTime(at, language, 'Europe/Paris'), '17:40');
  }
  assert.equal(formatTime(Date.parse('2026-11-15T23:05:00Z'), 'en', 'Europe/Paris'), '00:05');
});
