// -----------------------------------------------------------------------------
// The scene action `solunar_day` (the periods of today or tomorrow at a place,
// for a notification or a condition) and the configuration action
// `check_places` (every place the integration computes, in every language).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { KIND_NAMES, PHASE_NAMES, PHRASES, RATING_NAMES, STATUS, render } from './messages.js';
import { formatTime } from './time.js';

const logger = createLogger({ name: 'solunar-actions' });

export const SCENE_ACTION = 'solunar_day';
export const CONFIG_ACTION = 'check_places';
export const DAYS = ['today', 'tomorrow'];

/** "Major 13:32–15:32 ☀, Minor 18:05–19:05", in one language. */
export function periodList(day, language, timeZone) {
  const time = (ms) => formatTime(ms, language, timeZone);
  return day.periods
    .map(
      (period) =>
        `${KIND_NAMES[language][period.kind]} ${PHRASES[language].range({
          start: time(period.start),
          end: time(period.end),
        })}${period.enhanced ? ` (${PHRASES[language].sun})` : ''}`,
    )
    .join(', ');
}

/** One sentence about a day at a place. */
export function daySummary(monitor, place, day, language) {
  return PHRASES[language].day({
    place: monitor.displayName(place),
    rating: RATING_NAMES[language][day.rating],
    periods: periodList(day, language, monitor.timeZone),
    phase: PHASE_NAMES[language][day.phase.phase],
  });
}

/** Scene action: the day of a place, in the language of the configuration. */
export async function solunarDayAction(monitor, fields = {}) {
  const language = monitor.config.language;
  const place = monitor.placeOf(fields.device);
  if (place === null) {
    throw new Error(STATUS[language].noDevice);
  }
  const { today, tomorrow } = monitor.snapshot(place);
  const day = fields.day === 'tomorrow' ? tomorrow : today;
  return {
    summary: daySummary(monitor, place, day, language),
    rating: day.rating,
    periods: periodList(day, language, monitor.timeZone),
    moon_phase: PHASE_NAMES[language][day.phase.phase],
    illumination: Math.round(day.phase.illumination),
  };
}

/** Configuration action: every place and its day, in every language. */
export async function checkPlaces(monitor) {
  await monitor.reloadPlaces();
  logger.info(`Check requested: ${monitor.places.length} place(s)`);
  // Short (a toast shows 200 characters): the places and their rating today,
  // after the unreadable spots if any.
  const invalid =
    monitor.config.invalidSpots.length > 0
      ? render(STATUS, 'invalidSpot', { slots: monitor.config.invalidSpots.join(', ') })
      : null;
  if (monitor.places.length === 0) {
    return invalid ?? render(STATUS, 'noPlace');
  }
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const list = monitor.places
        .map((place) => {
          const { rating } = monitor.snapshot(place).today;
          return `${monitor.displayName(place)} (${rating}/4, ${RATING_NAMES[language][rating]})`;
        })
        .join(', ');
      const check = STATUS[language].check({ count: monitor.places.length, list });
      return [language, invalid ? `${invalid[language]} ${check}` : check];
    }),
  );
}
