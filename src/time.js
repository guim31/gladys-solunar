// -----------------------------------------------------------------------------
// Local days and clock times in a time zone (the `TZ` the Gladys supervisor
// injects), with Intl only: no dependency, daylight saving time included.
// -----------------------------------------------------------------------------

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** The time zone of the process (TZ), or UTC. */
export function defaultTimeZone() {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const partsFormatters = new Map();
function partsFormatter(timeZone) {
  if (!partsFormatters.has(timeZone)) {
    partsFormatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }),
    );
  }
  return partsFormatters.get(timeZone);
}

/** Local calendar fields of an instant. */
export function localParts(ms, timeZone) {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(new Date(ms))
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Offset of the time zone at an instant, in ms (local - UTC). */
function offsetAt(ms, timeZone) {
  const p = localParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant of local midnight of a calendar date (y, m 1-12, d), d may overflow. */
export function localMidnight(year, month, day, timeZone) {
  const wall = Date.UTC(year, month - 1, day);
  let guess = wall;
  // Two passes settle the offset, a third covers a change of offset in between.
  for (let i = 0; i < 3; i += 1) {
    guess = wall - offsetAt(guess, timeZone);
  }
  return guess;
}

/**
 * The local day containing `ms`: `{ key: 'YYYY-MM-DD', start, end }`, end
 * excluded (23 or 25 hours long on daylight saving days).
 */
export function localDay(ms, timeZone, shift = 0) {
  const p = localParts(ms, timeZone);
  const start = localMidnight(p.year, p.month, p.day + shift, timeZone);
  const end = localMidnight(p.year, p.month, p.day + shift + 1, timeZone);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day + shift));
  return { key: date.toISOString().slice(0, 10), start, end };
}

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
const timeFormatters = new Map();

/** "14:05", 24-hour clock in every language. */
export function formatTime(ms, language, timeZone) {
  const key = `${language}|${timeZone}`;
  if (!timeFormatters.has(key)) {
    timeFormatters.set(
      key,
      new Intl.DateTimeFormat(LOCALES[language] ?? 'en-GB', {
        timeZone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }
  return timeFormatters.get(key).format(new Date(ms));
}
