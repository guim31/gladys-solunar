// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle,
// never one line per tick; a failure repeated at every tick is logged once,
// plus one line when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureLogs, createAll, createWorld, tickAt } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [solunar] Started: 1 place(s), time zone Europe/Paris',
  ]);
});

test('ticks, periods and triggers write nothing at info', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  for (let minute = 30; minute < 50; minute += 1) {
    await tickAt(w, `2026-11-15T15:${minute}:00Z`);
  }
  assert.equal(w.fake.sceneEvents.length, 1);
  assert.deepEqual(lines, []);
});

test('states refused at every tick: one warning, then one line at recovery', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(w.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  for (let minute = 10; minute < 13; minute += 1) {
    await tickAt(w, `2026-11-15T09:${minute}:00Z`);
  }
  assert.equal(publish.mock.callCount(), 3);
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[solunar] Publishing the states failed: Gladys unreachable']],
  );
  publish.mock.restore();
  await tickAt(w, '2026-11-15T09:14:00Z');
  assert.match(lines.at(-1).text, /\[INFO\].*Publishing the states works again/);
});

test('the houses unreadable: one warning, the coordinates never logged', async (t) => {
  const w = await createWorld({ connect: false });
  t.after(() => w.app.stop());
  const lines = captureLogs(t, 'debug');
  w.gladys.getHouses = async () => {
    throw new Error('HTTP 403');
  };
  await w.gladys.connect();
  await w.app.ready;
  assert.ok(lines.some((l) => l.level === 'warn' && /Cannot read the houses/.test(l.text)));
  assert.ok(lines.every((l) => !/43\.6|1\.44/.test(l.text)));
});
