// -----------------------------------------------------------------------------
// Solunar periods (John Alden Knight's theory), computed locally with
// astronomy-engine. Pure: instants in ms and coordinates in, plain values out.
//
//   - major periods: the Moon crossing the meridian, overhead (upper transit)
//     or underfoot (lower transit), two hours centred on the transit;
//   - minor periods: moonrise and moonset, one hour centred on the event;
//   - a period is "enhanced" when a sunrise or a sunset falls within it, or
//     within 30 minutes of its edges (the classic solunar tables bonus);
//   - the day rating, 0 to 4: up to 2 points for the phase (2 within 1.5 days
//     of a new or full moon, 1 within 3.5 days) and up to 2 for the sun
//     (2 when a major period is enhanced, 1 when only a minor one is).
//
// A local day keeps the periods whose centre falls within it: the Moon comes
// back about 50 minutes later every day, so a day regularly lacks one of the
// four events (no moonrise, or one transit only). Beyond the polar circles the
// Moon may neither rise nor set for days: only the major periods remain.
// -----------------------------------------------------------------------------

import {
  Body,
  Illumination,
  MoonPhase,
  Observer,
  SearchHourAngle,
  SearchRiseSet,
} from 'astronomy-engine';
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time.js';

export const KINDS = ['major', 'minor'];
export const EVENTS = ['upper_transit', 'lower_transit', 'moonrise', 'moonset'];
export const HALF_WIDTH_MS = { major: HOUR_MS, minor: 30 * MINUTE_MS };
export const SUN_MARGIN_MS = 30 * MINUTE_MS;
export const SYNODIC_DAYS = 29.530588;
export const PHASES = [
  'new_moon',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full_moon',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
];

const ms = (astroTime) => astroTime.date.getTime();

/** Every event of `body` found by `search(from)` within [start, end). */
function collect(search, start, end) {
  const found = [];
  let from = start;
  for (let i = 0; i < 6; i += 1) {
    const at = search(from);
    if (at === null || at >= end) {
      break;
    }
    found.push(at);
    from = at + MINUTE_MS;
  }
  return found;
}

/** Rises (+1) or sets (-1) of `body` within [start, end). */
function riseSets(body, observer, direction, start, end) {
  return collect(
    (from) => {
      const found = SearchRiseSet(body, observer, direction, new Date(from), (end - from) / DAY_MS);
      return found === null ? null : ms(found);
    },
    start,
    end,
  );
}

function moonEvents(observer, start, end) {
  const transit = (hourAngle) => (from) =>
    ms(SearchHourAngle(Body.Moon, observer, hourAngle, new Date(from)).time);
  return [
    ...collect(transit(0), start, end).map((at) => ({ event: 'upper_transit', at })),
    ...collect(transit(12), start, end).map((at) => ({ event: 'lower_transit', at })),
    ...riseSets(Body.Moon, observer, +1, start, end).map((at) => ({ event: 'moonrise', at })),
    ...riseSets(Body.Moon, observer, -1, start, end).map((at) => ({ event: 'moonset', at })),
  ];
}

/** Phase of the Moon at an instant: name, illumination (%), days to the nearest new or full moon. */
export function moonPhase(at) {
  const angle = MoonPhase(new Date(at)); // 0 new moon, 90 first quarter, 180 full moon
  // The four principal phases are named within one day of their instant
  // (about 12.2 degrees), the crescents and gibbous moons in between.
  const DAY_DEGREES = 360 / SYNODIC_DAYS;
  const principal = Math.round(angle / 90) % 4;
  const index =
    Math.abs(angle - Math.round(angle / 90) * 90) <= DAY_DEGREES
      ? principal * 2
      : Math.floor(angle / 90) * 2 + 1;
  const fromSyzygy = Math.min(angle % 180, 180 - (angle % 180));
  return {
    phase: PHASES[index],
    angle,
    illumination: Illumination(Body.Moon, new Date(at)).phase_fraction * 100,
    daysFromNewOrFull: (fromSyzygy / 360) * SYNODIC_DAYS,
  };
}

/**
 * The solunar periods of a day.
 * @param {{ latitude: number, longitude: number }} place
 * @param {{ start: number, end: number }} day instants in ms, end excluded
 * @returns {{ periods: Array<{ kind, event, start, end, peak, enhanced }>,
 *   rating: number, phase: object, sunrise: number|null, sunset: number|null }}
 */
export function solunarDay(place, day) {
  const observer = new Observer(place.latitude, place.longitude, 0);
  // Sun events around the day too: a period near midnight may meet them.
  const margin = 3 * HOUR_MS;
  const suns = [
    ...riseSets(Body.Sun, observer, +1, day.start - margin, day.end + margin),
    ...riseSets(Body.Sun, observer, -1, day.start - margin, day.end + margin),
  ];
  const periods = moonEvents(observer, day.start, day.end)
    .map(({ event, at }) => {
      const kind = event.endsWith('transit') ? 'major' : 'minor';
      const start = at - HALF_WIDTH_MS[kind];
      const end = at + HALF_WIDTH_MS[kind];
      const enhanced = suns.some(
        (sun) => sun >= start - SUN_MARGIN_MS && sun <= end + SUN_MARGIN_MS,
      );
      return { kind, event, start, end, peak: at, enhanced };
    })
    .sort((a, b) => a.peak - b.peak);

  const phase = moonPhase((day.start + day.end) / 2);
  const phasePoints = phase.daysFromNewOrFull <= 1.5 ? 2 : phase.daysFromNewOrFull <= 3.5 ? 1 : 0;
  const sunPoints = periods.some((p) => p.enhanced && p.kind === 'major')
    ? 2
    : periods.some((p) => p.enhanced)
      ? 1
      : 0;
  return {
    periods,
    rating: phasePoints + sunPoints,
    phase,
    sunrise: riseSets(Body.Sun, observer, +1, day.start, day.end)[0] ?? null,
    sunset: riseSets(Body.Sun, observer, -1, day.start, day.end)[0] ?? null,
  };
}

/** The period in progress at `at` among `periods` (a major one wins an overlap), or null. */
export function currentPeriod(periods, at) {
  const running = periods.filter((p) => p.start <= at && at < p.end);
  return running.find((p) => p.kind === 'major') ?? running[0] ?? null;
}

/** The next period starting after `at`, or null. */
export function nextPeriod(periods, at) {
  return periods.filter((p) => p.start > at).sort((a, b) => a.start - b.start)[0] ?? null;
}
