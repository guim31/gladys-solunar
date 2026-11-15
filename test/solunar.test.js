// -----------------------------------------------------------------------------
// The computation against published tables:
//   - the US Naval Observatory (moonrise, moonset, transits, sunrise, sunset),
//     recorded for Toulouse, Lake Simcoe (Ontario) and Tromsø (beyond the
//     polar circle) on three dates (test/fixtures/usno, UTC);
//   - solunarforecast.com (major and minor periods of a day).
// Tolerance: 3 minutes (the tables round to the minute and use their own
// refraction and Moon models).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { currentPeriod, moonPhase, nextPeriod, solunarDay } from '../src/solunar.js';
import { formatTime, localDay } from '../src/time.js';

const TOLERANCE_MS = 3 * 60 * 1000;
const dir = new URL('./fixtures/usno/', import.meta.url);
const fixtures = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ name, ...JSON.parse(readFileSync(new URL(name, dir), 'utf8')) }));

const EVENT_OF = {
  Rise: 'moonrise',
  Set: 'moonset',
  'Upper Transit': 'upper_transit',
  'Lower Transit': 'lower_transit',
};

const utcDay = (date) => ({
  start: Date.parse(`${date}T00:00:00Z`),
  end: Date.parse(`${date}T24:00:00Z`),
});
const at = (date, time) => Date.parse(`${date}T${time}:00Z`);
const place = (coords) => {
  const [latitude, longitude] = coords.split(',').map(Number);
  return { latitude, longitude };
};

test('nine USNO days are recorded', () => {
  assert.equal(fixtures.length, 9);
});

for (const fixture of fixtures) {
  test(`moon events match the US Naval Observatory (${fixture.name})`, () => {
    const day = solunarDay(place(fixture.coords), utcDay(fixture.date));
    if (fixture.moondata.some((entry) => /continuously below/.test(entry.phen))) {
      // USNO lists nothing for a Moon that stays below the horizon; the
      // transits still make major periods (Knight counts them either way).
      assert.deepEqual(
        day.periods.map((p) => p.kind),
        ['major', 'major'],
      );
      return;
    }
    const expected = fixture.moondata
      .filter((entry) => entry.time !== null && EVENT_OF[entry.phen])
      .map((entry) => ({ event: EVENT_OF[entry.phen], at: at(fixture.date, entry.time) }));
    // USNO lists the lower transit only when the Moon does not rise or set.
    const ours = day.periods.filter(
      (period) =>
        period.event !== 'lower_transit' || expected.some((e) => e.event === 'lower_transit'),
    );
    assert.equal(ours.length, expected.length, JSON.stringify(ours.map((p) => p.event)));
    for (const event of expected) {
      const match = ours.find(
        (p) => p.event === event.event && Math.abs(p.peak - event.at) <= TOLERANCE_MS,
      );
      assert.ok(match, `${event.event} at ${new Date(event.at).toISOString()}`);
      const half = match.kind === 'major' ? 60 : 30;
      assert.equal(match.end - match.start, 2 * half * 60 * 1000);
    }
  });

  test(`sunrise and sunset match the US Naval Observatory (${fixture.name})`, () => {
    const day = solunarDay(place(fixture.coords), utcDay(fixture.date));
    const rise = fixture.sundata.find((entry) => entry.phen === 'Rise');
    const set = fixture.sundata.find((entry) => entry.phen === 'Set');
    for (const [ours, theirs] of [
      [day.sunrise, rise],
      [day.sunset, set],
    ]) {
      if (theirs === undefined) {
        assert.equal(ours, null);
      } else {
        assert.ok(Math.abs(ours - at(fixture.date, theirs.time)) <= TOLERANCE_MS, theirs.phen);
      }
    }
  });
}

test('the periods match solunarforecast.com (Beverly Hills, 15/11/2026)', () => {
  const table = JSON.parse(
    readFileSync(
      new URL('./fixtures/solunarforecast-beverly-hills-2026-11-15.json', import.meta.url),
      'utf8',
    ),
  );
  const { timeZone } = table.place;
  const day = solunarDay(table.place, localDay(Date.parse('2026-11-15T20:00:00Z'), timeZone));
  const minutes = (text) => {
    const [h, m] = text.split(':').map(Number);
    return h * 60 + m;
  };
  const local = (ms) => minutes(formatTime(ms, 'en', timeZone));
  for (const kind of ['major', 'minor']) {
    const ours = day.periods.filter((p) => p.kind === kind);
    assert.equal(ours.length, table[kind].length, kind);
    ours.forEach((period, index) => {
      const [start, end] = table[kind][index];
      assert.ok(Math.abs(local(period.start) - minutes(start)) <= 3, `${kind} ${start}`);
      assert.ok(Math.abs(local(period.end) - minutes(end)) <= 3, `${kind} ${end}`);
    });
  }
  assert.ok(Math.abs(local(day.sunrise) - minutes(table.sunrise)) <= 3);
  assert.ok(Math.abs(local(day.sunset) - minutes(table.sunset)) <= 3);
});

test('beyond the polar circle: a circumpolar full moon in the polar night', () => {
  // Tromsø, 03/01/2026: the Moon never sets, the Sun never rises.
  const day = solunarDay({ latitude: 69.6496, longitude: 18.956 }, utcDay('2026-01-03'));
  assert.deepEqual(
    day.periods.map((p) => p.kind),
    ['major', 'major'],
  );
  assert.equal(day.sunrise, null);
  assert.equal(day.sunset, null);
  assert.ok(day.periods.every((p) => !p.enhanced));
  assert.equal(day.phase.phase, 'full_moon');
  // Full moon (2 points), no sun (0).
  assert.equal(day.rating, 2);
});

test('the rating: phase points, then sun points', () => {
  // Toulouse 15/11/2026, Paris time: first quarter in 2 days (0), the upper
  // transit 17:40 meets the 17:29 sunset (2).
  const toulouse = solunarDay(
    { latitude: 43.6047, longitude: 1.4442 },
    localDay(Date.parse('2026-11-15T12:00:00Z'), 'Europe/Paris'),
  );
  assert.equal(toulouse.rating, 2);
  assert.ok(toulouse.periods.find((p) => p.event === 'upper_transit').enhanced);
  // Toulouse 24/11/2026: full moon (2), the moonrise meets the sunset (1).
  const full = solunarDay(
    { latitude: 43.6047, longitude: 1.4442 },
    localDay(Date.parse('2026-11-24T12:00:00Z'), 'Europe/Paris'),
  );
  assert.equal(full.phase.phase, 'full_moon');
  assert.ok(full.rating >= 2 && full.rating <= 4);
  for (let i = 0; i < 30; i += 1) {
    const { rating } = solunarDay(
      { latitude: 43.6047, longitude: 1.4442 },
      localDay(Date.parse('2026-11-01T12:00:00Z') + i * 86400000, 'Europe/Paris'),
    );
    assert.ok(Number.isInteger(rating) && rating >= 0 && rating <= 4);
  }
});

test('a day keeps the periods centred in it, at most two of each kind', () => {
  for (let i = 0; i < 30; i += 1) {
    const day = localDay(Date.parse('2026-11-01T12:00:00Z') + i * 86400000, 'Europe/Paris');
    const { periods } = solunarDay({ latitude: 43.6047, longitude: 1.4442 }, day);
    assert.ok(periods.every((p) => p.peak >= day.start && p.peak < day.end));
    assert.ok(periods.filter((p) => p.kind === 'major').length <= 2);
    assert.ok(periods.filter((p) => p.kind === 'minor').length <= 2);
    assert.ok(periods.length >= 2);
  }
});

test('the moon phases around a full moon', () => {
  assert.equal(moonPhase(Date.parse('2026-11-24T14:53:00Z')).phase, 'full_moon');
  assert.ok(moonPhase(Date.parse('2026-11-24T14:53:00Z')).illumination > 99);
  assert.ok(moonPhase(Date.parse('2026-11-24T14:53:00Z')).daysFromNewOrFull < 0.1);
  assert.equal(moonPhase(Date.parse('2026-11-20T12:00:00Z')).phase, 'waxing_gibbous');
  assert.equal(moonPhase(Date.parse('2026-11-28T12:00:00Z')).phase, 'waning_gibbous');
});

test('current and next period: a major one wins an overlap', () => {
  const periods = [
    { kind: 'minor', start: 100, end: 160, peak: 130 },
    { kind: 'major', start: 140, end: 260, peak: 200 },
    { kind: 'minor', start: 400, end: 460, peak: 430 },
  ];
  assert.equal(currentPeriod(periods, 90), null);
  assert.equal(currentPeriod(periods, 120).kind, 'minor');
  assert.equal(currentPeriod(periods, 150).kind, 'major');
  assert.equal(currentPeriod(periods, 260), null);
  assert.equal(nextPeriod(periods, 120).peak, 200);
  assert.equal(nextPeriod(periods, 400), null);
});
