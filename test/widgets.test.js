// -----------------------------------------------------------------------------
// The `solunar_day` widget, through the SDK's fake Gladys, checked with the
// SDK's own validator and the core's budget (8 components, 2 texts at most).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createAll, createWorld, tickAt } from './helpers/world.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function widget(w, options) {
  const ack = await w.fake.widgetGet('solunar_day', options);
  assert.equal(ack.success, true, JSON.stringify(ack));
  const { content } = ack.data;
  assert.deepEqual(validateWidgetContent(content), [], JSON.stringify(content));
  assert.ok(content.components.length <= 8);
  assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
  return content;
}

for (const language of ['en', 'fr', 'de', 'es']) {
  test(`the day of a place, valid in ${language}`, async (t) => {
    const w = await world(t);
    await createAll(w);
    await tickAt(w, '2026-11-15T16:00:00Z');
    const content = await widget(w, { language, settings: {} });
    const status = content.components.find((c) => c.type === 'status');
    assert.equal(status.items.length, 4);
    assert.equal(status.items.filter((item) => item.color === 'success').length, 1);
    assert.match(status.items[2].label, /16:40–18:40 ☀$/);
  });
}

test('the chosen place, with the name given in Gladys', async (t) => {
  const w = await world(t, {
    config: { spot_1_name: 'Lake Simcoe', spot_1_coordinates: '44.42, -79.37' },
  });
  await createAll(w);
  const [, lake] = w.fake.discoveredDevices;
  w.gladys.devices.find((d) => d.external_id === lake.external_id).name = 'Mon lac';
  const content = await widget(w, { language: 'fr', settings: { device: lake.external_id } });
  assert.match(content.components.at(-1).text, /^Mon lac · /);
});

test('show_moon off hides the moon tile and the phase', async (t) => {
  const w = await world(t);
  const content = await widget(w, { language: 'en', settings: { show_moon: false } });
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['value', 'status', 'text'],
  );
  assert.doesNotMatch(content.components.at(-1).text, /crescent/i);
});

test('a place that no longer exists, or no place at all: a hint', async (t) => {
  const w = await world(t);
  const gone = await widget(w, { language: 'fr', settings: { device: 'ext:gone' } });
  assert.equal(gone.components[0].text, 'Choisissez un lieu dans les réglages');
  const empty = await world(t, { houses: [] });
  const none = await widget(empty, { language: 'en', settings: {} });
  assert.equal(none.components.length, 1);
});

test('a period starting asks the dashboards to refresh', async (t) => {
  const w = await world(t);
  await createAll(w);
  const before = w.fake.widgetRefreshes.length;
  await tickAt(w, '2026-11-15T15:41:00Z');
  assert.equal(w.fake.widgetRefreshes.length, before + 1);
  await tickAt(w, '2026-11-15T15:42:00Z');
  assert.equal(w.fake.widgetRefreshes.length, before + 1);
});
