// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Places: the located houses of Gladys (`use_houses`) and up to three fishing
// spots typed by hand, each a name and a "latitude, longitude" text field (a
// number field of the Gladys form only takes integers, see CLAUDE.md).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
export const SPOT_SLOTS = [1, 2, 3];

export const DEFAULT_CONFIG = {
  language: 'fr',
  use_houses: true,
  ...Object.fromEntries(
    SPOT_SLOTS.flatMap((slot) => [
      [`spot_${slot}_name`, ''],
      [`spot_${slot}_coordinates`, ''],
    ]),
  ),
};

/**
 * "43.6047, 1.4442", "43,6047; 1,4442", "43.6047 1.4442" or "43,6047, 1,4442"
 * (decimal commas): `{ latitude, longitude }`, or null when it cannot be read.
 */
export function parseCoordinates(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') {
    return null;
  }
  let parts;
  if (text.includes(';')) {
    parts = text.split(';');
  } else if (/\s/.test(text.replace(/,\s+/g, ','))) {
    // "43,6 1,4": blanks separate, the commas are decimal commas.
    parts = text.replace(/,\s+/g, ' ').split(/\s+/);
  } else {
    const commas = text.split(',');
    parts =
      commas.length === 4 ? [commas.slice(0, 2).join('.'), commas.slice(2).join('.')] : commas;
  }
  if (parts.length !== 2) {
    return null;
  }
  const values = parts.map((part) => part.trim().replace(',', '.'));
  // Plain decimal degrees only: an empty half ("43.6,") is not a 0.
  if (!values.every((value) => /^[-+]?\d+(\.\d+)?$/.test(value))) {
    return null;
  }
  const [latitude, longitude] = values.map(Number);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

const toBoolean = (raw, fallback) =>
  raw === undefined || raw === null || raw === '' ? fallback : raw !== false && raw !== 'false';

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 * @returns {{ language: string, useHouses: boolean,
 *   spots: Array<{ slot: number, name: string, latitude: number, longitude: number }>,
 *   invalidSpots: number[] }}
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const spots = [];
  const invalidSpots = [];
  for (const slot of SPOT_SLOTS) {
    const name = String(source[`spot_${slot}_name`] ?? '').trim();
    const text = String(source[`spot_${slot}_coordinates`] ?? '').trim();
    if (text === '') {
      continue;
    }
    const coordinates = parseCoordinates(text);
    if (coordinates === null) {
      invalidSpots.push(slot);
      continue;
    }
    spots.push({ slot, name: name.slice(0, 40) || null, ...coordinates });
  }
  return {
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    useHouses: toBoolean(source.use_houses, DEFAULT_CONFIG.use_houses),
    spots,
    invalidSpots,
  };
}
