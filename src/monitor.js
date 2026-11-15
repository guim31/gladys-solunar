// -----------------------------------------------------------------------------
// The monitor: resolves the places (located houses of Gladys and fishing spots
// of the configuration), computes their solunar days, publishes the states of
// the created devices every minute, fires the scene trigger and serves the
// widget and the actions.
//
// Nothing goes to the network: a tick is a few astronomy computations (the
// three days around now are cached per place and recomputed when the local
// day changes). `publishChangedStates` sends only what changed, plus a
// heartbeat every 12 hours.
//
// Trigger `period_started`: fired when a tick finds a place in a period it was
// not in at the previous tick. The first tick after a start only takes the
// starting point (a restart in the middle of a period does not fire it again).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { NEXT_IN_MAX, buildDevice, placeIds, placeName } from './device.js';
import { KIND_NAMES, PHASE_NAMES, PHRASES, STATUS, render } from './messages.js';
import { currentPeriod, moonPhase, nextPeriod, solunarDay } from './solunar.js';
import { HOUR_MS, MINUTE_MS, defaultTimeZone, formatTime, localDay } from './time.js';

const logger = createLogger({ name: 'solunar' });

export const WIDGET_KEY = 'solunar_day';
export const TRIGGER = 'period_started';

export const DEFAULT_TIMINGS = {
  tickMs: MINUTE_MS,
  heartbeatMs: 12 * HOUR_MS,
  // The houses have no update event: read again every 6 hours.
  housesMs: 6 * HOUR_MS,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {boolean} [options.timers] false: no background timer (tests drive the ticks)
   * @param {Function} [options.now] clock in ms
   * @param {string} [options.timeZone] defaults to TZ
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, timers = true, now, timeZone, timings }) {
    this.gladys = gladys;
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timeZone = timeZone ?? defaultTimeZone();
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = normalizeConfig({});
    this.houses = [];
    this.housesAt = -Infinity;
    this.places = [];
    // Per place id: { key, days: [yesterday, today, tomorrow] }.
    this.cache = new Map();
    // Per place id: the peak of the period seen at the previous tick (null: none).
    this.previous = new Map();
    this.fired = new Set();
    this.discoveredKey = null;
    this.statusKey = undefined;
    this.signature = null;
    this.tickTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.stopped = false;
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    await this.loadHouses();
    this.schedule();
    await this.publishDiscovered();
    logger.info(`Started: ${this.places.length} place(s), time zone ${this.timeZone}`);
    await this.runTick();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    await this.loadHouses();
    this.discoveredKey = null;
    await this.publishDiscovered();
    this.statusKey = undefined;
    this.gladys.forgetPublishedStates?.();
    await this.runTick();
    this.requestRefresh();
  }

  async reconfigure(config) {
    await this.running;
    this.config = config;
    logger.info('Configuration saved');
    await this.loadHouses();
    this.discoveredKey = null;
    await this.publishDiscovered();
    // Texts of the states in the new language, places added or moved.
    this.cache.clear();
    await this.runTick();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.tickTimer);
    clearTimeout(this.refreshTimer);
    this.tickTimer = null;
    await this.running?.catch(() => {});
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.runTick(), this.timings.tickMs);
    this.tickTimer.unref?.();
  }

  // --- Places ------------------------------------------------------------------

  async loadHouses() {
    this.housesAt = this.now();
    if (!this.config.useHouses) {
      this.houses = [];
    } else {
      try {
        const houses = await this.gladys.getHouses();
        this.houses = (Array.isArray(houses) ? houses : []).filter(
          (house) =>
            house?.selector && Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
        );
        this.recovered('houses', 'The houses of Gladys are read again');
      } catch (err) {
        // Keep the houses of the last reading.
        this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      }
    }
    this.places = [
      ...this.houses.map((house) => ({
        id: `house-${house.selector}`,
        kind: 'house',
        name: house.name ?? house.selector,
        latitude: house.latitude,
        longitude: house.longitude,
      })),
      ...this.config.spots.map((spot) => ({
        id: `spot-${spot.slot}`,
        kind: 'spot',
        slot: spot.slot,
        name: spot.name,
        latitude: spot.latitude,
        longitude: spot.longitude,
      })),
    ];
  }

  /** A scan or the check action: read the houses again, publish the places. */
  async reloadPlaces() {
    await this.running;
    await this.loadHouses();
    this.discoveredKey = null;
    await this.publishDiscovered();
    await this.runTick();
  }

  placeOf(deviceExternalId) {
    return (
      this.places.find((place) => placeIds(this.gladys, place).device === deviceExternalId) ?? null
    );
  }

  isCreated(place) {
    const id = placeIds(this.gladys, place).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The name the user gave the device in Gladys, else the default one. */
  displayName(place) {
    const id = placeIds(this.gladys, place).device;
    const device = (this.gladys.devices ?? []).find((entry) => entry.external_id === id);
    return device?.name ?? placeName(place, this.config.language);
  }

  async publishDiscovered() {
    const devices = this.places.map((place) =>
      buildDevice(this.gladys, place, this.config.language),
    );
    const key = JSON.stringify(devices);
    if (key === this.discoveredKey) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discoveredKey = key;
      this.recovered('discovery', 'The places are published again');
    } catch (err) {
      this.failed('discovery', 'warn', `Publishing the places failed: ${err.message}`);
    }
  }

  // --- Computation -------------------------------------------------------------

  /** Yesterday, today and tomorrow of a place, cached for the local day. */
  days(place, at = this.now()) {
    const today = localDay(at, this.timeZone);
    const key = `${today.key}|${place.latitude}|${place.longitude}`;
    const cached = this.cache.get(place.id);
    if (cached?.key === key) {
      return cached.days;
    }
    const days = [-1, 0, 1].map((shift) => {
      const day = shift === 0 ? today : localDay(at, this.timeZone, shift);
      return { ...day, ...solunarDay(place, day) };
    });
    this.cache.set(place.id, { key, days });
    return days;
  }

  /** What a place looks like at `at`: today, the current and the next period, the moon. */
  snapshot(place, at = this.now()) {
    const days = this.days(place, at);
    const periods = days.flatMap((day) => day.periods);
    return {
      today: days[1],
      tomorrow: days[2],
      current: currentPeriod(periods, at),
      next: nextPeriod(periods, at),
      moon: moonPhase(at),
    };
  }

  /** The states of a place, texts in the language of the configuration. */
  statesOf(place, snapshot, at = this.now()) {
    const ids = placeIds(this.gladys, place);
    const language = this.config.language;
    const time = (ms) => formatTime(ms, language, this.timeZone);
    const kinds = KIND_NAMES[language];
    const { current, next, today, moon } = snapshot;
    const states = [
      {
        device_feature_external_id: ids.feature('period'),
        text: current
          ? PHRASES[language].current({ kind: kinds[current.kind], end: time(current.end) })
          : kinds.none,
      },
      { device_feature_external_id: ids.feature('active'), state: current ? 1 : 0 },
      { device_feature_external_id: ids.feature('rating'), state: today.rating },
      {
        device_feature_external_id: ids.feature('moon_phase'),
        text: PHASE_NAMES[language][moon.phase],
      },
      {
        device_feature_external_id: ids.feature('illumination'),
        state: Math.round(moon.illumination),
      },
    ];
    if (next) {
      states.push(
        {
          device_feature_external_id: ids.feature('next_period'),
          text: PHRASES[language].next({
            kind: kinds[next.kind],
            start: time(next.start),
            tomorrow: next.start >= today.end,
          }),
        },
        {
          device_feature_external_id: ids.feature('next_in'),
          state: Math.min(NEXT_IN_MAX, Math.ceil((next.start - at) / MINUTE_MS)),
        },
      );
    }
    return states;
  }

  // --- Ticks -------------------------------------------------------------------

  runTick() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.tick()
      .catch((err) => this.failed('tick', 'error', 'Solunar tick failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async tick() {
    const at = this.now();
    if (at - this.housesAt >= this.timings.housesMs) {
      await this.loadHouses();
    }
    await this.publishDiscovered();
    const states = [];
    const signature = [];
    for (const place of this.places) {
      const snapshot = this.snapshot(place, at);
      await this.detectStart(place, snapshot);
      signature.push(place.id, snapshot.today.key, snapshot.current?.peak ?? null);
      if (this.isCreated(place)) {
        states.push(...this.statesOf(place, snapshot, at));
      }
    }
    logger.debug(`Tick: ${this.places.length} place(s), ${states.length} state(s)`);
    await this.publish(states);
    this.recovered('tick', 'Solunar ticks work again');
    await this.updateConnectionStatus();
    const key = JSON.stringify(signature);
    if (key !== this.signature) {
      this.signature = key;
      this.requestRefresh();
    }
  }

  async detectStart(place, snapshot) {
    const { current } = snapshot;
    const seen = this.previous.has(place.id);
    const before = this.previous.get(place.id) ?? null;
    this.previous.set(place.id, current?.peak ?? null);
    if (!seen || current === null || current.peak === before) {
      return;
    }
    const firedKey = `${place.id}:${current.peak}`;
    if (this.fired.has(firedKey)) {
      return;
    }
    this.fired.add(firedKey);
    if (this.fired.size > 200) {
      this.fired.delete(this.fired.values().next().value);
    }
    if (!this.isCreated(place)) {
      return;
    }
    const data = this.eventData(place, snapshot);
    logger.debug(`Solunar ${current.kind} period started at ${place.id}`);
    try {
      await this.gladys.publishSceneEvent(TRIGGER, data);
      this.recovered('scene', 'Scene triggers work again');
    } catch (err) {
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
    }
  }

  /** The flat data of the scene event (fields, then variables of the manifest). */
  eventData(place, { current, today }) {
    const language = this.config.language;
    const time = (ms) => formatTime(ms, language, this.timeZone);
    const name = this.displayName(place);
    return {
      device: placeIds(this.gladys, place).device,
      kind: current.kind,
      rating: String(today.rating),
      place: name,
      start: time(current.start),
      end: time(current.end),
      with_sun: current.enhanced,
      summary: PHRASES[language].started({
        kind: KIND_NAMES[language][current.kind],
        place: name,
        start: time(current.start),
        end: time(current.end),
        sun: current.enhanced,
      }),
    };
  }

  async publish(states) {
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next tick (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    let message;
    if (this.config.invalidSpots.length > 0) {
      message = render(STATUS, 'invalidSpot', { slots: this.config.invalidSpots.join(', ') });
    } else if (this.places.length === 0) {
      message = render(STATUS, 'noPlace');
    }
    const connected = this.places.length > 0;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusKey) {
      return;
    }
    this.statusKey = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    const place = this.placeOf(device?.external_id);
    if (place === null) {
      return;
    }
    // Every state of the new device, even those that did not change.
    const at = this.now();
    await this.publish(this.statesOf(place, this.snapshot(place, at), at));
    this.requestRefresh();
  }

  /** "Update" in the Discover tab, a rename, a deletion: the widget shows the names. */
  async onDeviceChanged(device) {
    const place = this.placeOf(device?.external_id);
    if (place !== null && this.isCreated(place)) {
      const at = this.now();
      await this.publish(this.statesOf(place, this.snapshot(place, at), at));
    }
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (this.placeOf(device?.external_id) !== null) {
      await this.runTick();
    }
  }

  // --- Widget ------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}
