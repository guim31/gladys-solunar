// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (with houses), a manual clock,
// the Europe/Paris time zone, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

process.env.LOG_LEVEL ??= 'silent';

export const TIME_ZONE = 'Europe/Paris';
export const TOULOUSE = { latitude: 43.6047, longitude: 1.4442 };
export const HOUSE = { id: 'h1', name: 'Maison', selector: 'maison', ...TOULOUSE };

// 15/11/2026 in Toulouse: lower transit 05:17, moonrise 13:02, upper transit
// 17:40 (with the 17:29 sunset), moonset 22:25, local time (UTC+1).
export const START = Date.parse('2026-11-15T08:00:00Z');

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    set(iso) {
      clock.time = Date.parse(iso);
    },
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.houses] houses of Gladys (GET /house)
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = {},
  houses = [HOUSE],
  devices = [],
  connect = true,
  clock = createClock(),
} = {}) {
  const gladys = createFakeGladys({ config, houses, devices });
  const app = registerHandlers(gladys, {
    timers: false,
    now: clock.now,
    timeZone: TIME_ZONE,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, clock };
}

/** Create every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

/** The last published value of a feature, by its key (first place by default). */
export function valueOf(world, key, placeId = 'house-maison') {
  const states = world.fake.states.filter((state) =>
    state.device_feature_external_id.endsWith(`:${placeId}:${key}`),
  );
  const last = states.at(-1);
  return last === undefined ? undefined : (last.text ?? last.state);
}

/** Move the clock to an instant and run one tick. */
export async function tickAt(world, iso) {
  world.clock.set(iso);
  await world.monitor.runTick();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
