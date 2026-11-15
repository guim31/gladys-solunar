// -----------------------------------------------------------------------------
// The monitor against the SDK's fake Gladys, on 15/11/2026 in Toulouse
// (Paris time): major 04:17–06:17, minor 12:32–13:32, major 16:40–18:40 (with
// the sunset), minor 21:55–22:55.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE, createAll, createWorld, tickAt, valueOf } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('one device per located house and per spot; unlocated houses are skipped', async (t) => {
  const w = await world(t, {
    houses: [
      HOUSE,
      { id: 'h2', name: 'Chalet', selector: 'chalet', latitude: null, longitude: null },
    ],
    config: { spot_2_name: 'Lake Simcoe', spot_2_coordinates: '44.42, -79.37' },
  });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => [device.external_id.split(':').at(-1), device.name]),
    [
      ['house-maison', 'Solunaire Maison'],
      ['spot-2', 'Lake Simcoe'],
    ],
  );
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.equal(w.fake.connectionStatus.message, undefined);
});

test('no state before the device is created, every state at its creation', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.states.length, 0);
  await createAll(w);
  assert.equal(w.fake.states.length, 7);
  assert.equal(valueOf(w, 'period'), 'Aucune');
  assert.equal(valueOf(w, 'active'), 0);
  assert.equal(valueOf(w, 'next_period'), 'Mineure à 12:32');
  // 09:00 → 12:32 and some seconds, rounded up.
  assert.equal(valueOf(w, 'next_in'), 213);
  assert.equal(valueOf(w, 'rating'), 2);
  assert.equal(valueOf(w, 'moon_phase'), 'Premier croissant');
  assert.equal(valueOf(w, 'illumination'), 30);
});

test('a period starting fires the trigger once, with its filters and variables', async (t) => {
  const w = await world(t);
  await createAll(w);
  await tickAt(w, '2026-11-15T15:39:00Z');
  assert.equal(w.fake.sceneEvents.length, 0);
  await tickAt(w, '2026-11-15T15:41:00Z');
  await tickAt(w, '2026-11-15T15:42:00Z');
  assert.deepEqual(w.fake.sceneEvents, [
    {
      key: 'period_started',
      data: {
        device: w.fake.discoveredDevices[0].external_id,
        kind: 'major',
        rating: '2',
        place: 'Solunaire Maison',
        start: '16:40',
        end: '18:40',
        with_sun: true,
        summary: 'Période solunaire majeure (Solunaire Maison), 16:40–18:40, avec le soleil.',
      },
    },
  ]);
  assert.equal(valueOf(w, 'period'), "Majeure jusqu'à 18:40");
  assert.equal(valueOf(w, 'active'), 1);
  assert.equal(valueOf(w, 'next_period'), 'Mineure à 21:55');
  await tickAt(w, '2026-11-15T17:41:00Z');
  assert.equal(valueOf(w, 'active'), 0);
  await tickAt(w, '2026-11-15T20:56:00Z');
  assert.equal(w.fake.sceneEvents.at(-1).data.kind, 'minor');
  assert.equal(w.fake.sceneEvents.length, 2);
});

test('the first tick is a starting point: a start in the middle of a period fires nothing', async (t) => {
  // Started at 09:00: the major period began while it ran, it fires.
  const inside = await world(t);
  await createAll(inside);
  await tickAt(inside, '2026-11-15T15:44:00Z');
  assert.equal(inside.fake.sceneEvents.length, 1);
  // A tick long after a start (a sleeping host) does not fire it late.
  const asleep = await world(t);
  await createAll(asleep);
  await tickAt(asleep, '2026-11-15T16:00:00Z');
  assert.equal(asleep.fake.sceneEvents.length, 0);
  // Started at 17:00, inside the major period: nothing fires.
  const late = await createWorld({
    clock: { time: 0, now: () => Date.parse('2026-11-15T16:00:00Z') },
  });
  t.after(() => late.app.stop());
  await createAll(late);
  await late.monitor.runTick();
  assert.equal(late.fake.sceneEvents.length, 0);
  assert.equal(valueOf(late, 'active'), 1);
});

test('no trigger for a place not created in Gladys', async (t) => {
  const w = await world(t);
  await tickAt(w, '2026-11-15T15:41:00Z');
  assert.equal(w.fake.sceneEvents.length, 0);
  assert.equal(w.fake.states.length, 0);
});

test('the next period of the evening is tomorrow', async (t) => {
  const w = await world(t);
  await createAll(w);
  await tickAt(w, '2026-11-15T22:30:00Z');
  assert.match(valueOf(w, 'next_period'), /^Majeure demain à 0\d:\d\d$/);
});

test('only changes are published between two ticks', async (t) => {
  const w = await world(t);
  await createAll(w);
  const before = w.fake.states.length;
  await tickAt(w, '2026-11-15T08:00:01Z');
  assert.equal(w.fake.states.length, before);
  await tickAt(w, '2026-11-15T08:01:00Z');
  // next_in only.
  assert.deepEqual(
    w.fake.states.slice(before).map((s) => s.device_feature_external_id.split(':').at(-1)),
    ['next_in'],
  );
});

test('no place: disconnected, with the way to add one', async (t) => {
  const w = await world(t, { houses: [] });
  assert.equal(w.fake.discoveredDevices.length, 0);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.fr, /localisez une maison/);
  assert.deepEqual(Object.keys(w.fake.connectionStatus.message), ['en', 'fr', 'de', 'es']);
});

test('an unreadable spot is said in the status, the other places still work', async (t) => {
  const w = await world(t, { config: { spot_1_coordinates: 'au bout du ponton' } });
  assert.equal(w.fake.discoveredDevices.length, 1);
  assert.equal(w.fake.connectionStatus.connected, true);
  assert.match(w.fake.connectionStatus.message.en, /spot 1/);
});

test('use_houses off, or the houses unreadable: the spots only', async (t) => {
  const off = await world(t, {
    config: { use_houses: false, spot_1_coordinates: '44.42, -79.37' },
  });
  assert.deepEqual(
    off.fake.discoveredDevices.map((d) => d.name),
    ['Coin de pêche 1'],
  );
  const failing = await createWorld({
    connect: false,
    config: { spot_1_coordinates: '44.42, -79.37' },
  });
  t.after(() => failing.app.stop());
  failing.gladys.getHouses = async () => {
    throw new Error('HTTP 403');
  };
  await failing.gladys.connect();
  await failing.app.ready;
  assert.deepEqual(
    failing.fake.discoveredDevices.map((d) => d.name),
    ['Coin de pêche 1'],
  );
});

test('a new language: new texts at once, and new names for devices not created yet', async (t) => {
  const w = await world(t);
  await createAll(w);
  await w.fake.configUpdated({ language: 'en', spot_1_coordinates: '44.42, -79.37' });
  assert.equal(valueOf(w, 'period'), 'None');
  assert.equal(valueOf(w, 'moon_phase'), 'Waxing crescent');
  assert.equal(w.fake.discoveredDevices.at(-1).name, 'Fishing spot 1');
  assert.equal(w.fake.discoveredDevices.at(-1).features[0].name, 'Solunar period');
});

test('the container ticks by itself, without Gladys polling', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const { registerHandlers } = await import('../src/app.js');
  const { createFakeGladys } = await import('@gladysassistant/integration-sdk/testing');
  const gladys = createFakeGladys({ houses: [HOUSE] });
  let now = Date.parse('2026-11-15T15:39:30Z');
  const app = registerHandlers(gladys, { now: () => now, timeZone: 'Europe/Paris' });
  t.after(() => app.stop());
  await gladys.connect();
  await app.ready;
  await app.monitor.running;
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(device);
  }
  now = Date.parse('2026-11-15T15:41:30Z');
  t.mock.timers.tick(60000);
  await app.monitor.running;
  assert.equal(gladys.fake.sceneEvents.length, 1);
  assert.equal(gladys.fake.requests.filter((r) => /poll/.test(r.path ?? '')).length, 0);
});

test('the scene action gives the day of a place', async (t) => {
  const w = await world(t);
  await createAll(w);
  const device = w.fake.discoveredDevices[0].external_id;
  const { data } = await w.fake.sceneAction('solunar_day', { device });
  assert.equal(data.outputs.rating, 2);
  assert.equal(
    data.outputs.periods,
    'Majeure 04:17–06:17, Mineure 12:32–13:32, Majeure 16:40–18:40 (avec le soleil), Mineure 21:55–22:55',
  );
  assert.match(data.outputs.summary, /^Solunaire Maison : journée moyenne\. Majeure 04:17/);
  const tomorrow = await w.fake.sceneAction('solunar_day', { device, day: 'tomorrow' });
  assert.match(tomorrow.data.outputs.periods, /^Majeure 05:\d\d/);
  const unknown = await w.fake.sceneAction('solunar_day', { device: 'nope' });
  assert.equal(unknown.success, false);
});

test('the check action lists the places in every language', async (t) => {
  const w = await world(t);
  const { data } = await w.fake.action('check_places');
  const message = data.message ?? data;
  assert.deepEqual(Object.keys(message), ['en', 'fr', 'de', 'es']);
  assert.equal(message.fr, '1 lieu(x) : Solunaire Maison (2/4, Moyenne)');
  const bad = await world(t, { config: { spot_3_coordinates: 'x' } });
  const both = await bad.fake.action('check_places');
  assert.match(
    (both.data.message ?? both.data).en,
    /^Unreadable coordinates for spot 3: .* 1 place\(s\): /,
  );
});

test('an out-of-range house is skipped, the other places still work', async (t) => {
  const w = await world(t, {
    houses: [HOUSE, { id: 'h3', name: 'Typo', selector: 'typo', latitude: 95, longitude: 1 }],
  });
  assert.deepEqual(
    w.fake.discoveredDevices.map((d) => d.name),
    ['Solunaire Maison'],
  );
  await createAll(w);
  assert.equal(w.fake.states.length, 7);
});

test('Spanish texts: "a la 01:10", "a las 13:10"', async (t) => {
  const w = await world(t, { config: { language: 'es' } });
  await createAll(w);
  await tickAt(w, '2026-11-15T22:30:00Z');
  assert.match(
    valueOf(w, 'next_period'),
    /^Mayor mañana a las 0[2-9]:\d\d$|^Mayor mañana a la 01:\d\d$/,
  );
  await tickAt(w, '2026-11-15T15:41:00Z');
  assert.equal(valueOf(w, 'period'), 'Mayor hasta las 18:40');
});
