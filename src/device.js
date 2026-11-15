// -----------------------------------------------------------------------------
// One Gladys device per place: each located house of Gladys, and each fishing
// spot of the configuration.
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js):
//   - period        text/text       "Major until 15:32", "None";
//   - active        input/binary    1 during a major or minor period;
//   - next_period   text/text       "Minor at 18:05", "Major tomorrow at 02:10";
//   - next_in       duration/integer minutes to the next period (scene
//                   conditions: "30 minutes before");
//   - rating        counter-sensor/integer, the day rating 0 to 4;
//   - moon_phase    text/text;
//   - illumination  counter-sensor/integer, % (no percent couple for the moon:
//                   the unit is in the name).
//
// Platform ids: `house-<selector>` (the house selector is stable in Gladys)
// and `spot-<slot>` (the slot 1 to 3 of the form, so renaming a spot or
// correcting its coordinates keeps the device and its history).
// Published with should_poll: false: the states are computed in the
// container every minute (src/monitor.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './messages.js';

export const DEVICE_TYPE = 'place';
export const NEXT_IN_MAX = 2 * 24 * 60;

/** External ids of a place's device, and of its features by key. */
export function placeIds(gladys, place) {
  return gladys.externalIds(DEVICE_TYPE, place.id);
}

/** The default name of a place (frozen at creation, renamable in Gladys). */
export function placeName(place, language) {
  const names = NAMES[language] ?? NAMES.fr;
  if (place.kind === 'house') {
    return `${names.house} ${place.name}`;
  }
  return place.name ?? `${names.spot} ${place.slot}`;
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 0,
  ...extra,
});

/** The discovery payload of a place. */
export function buildDevice(gladys, place, language = 'fr') {
  const ids = placeIds(gladys, place);
  const names = NAMES[language] ?? NAMES.fr;
  const text = (key) =>
    sensor(names[key], ids.feature(key), CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
      keep_history: false,
    });
  return {
    name: placeName(place, language),
    external_id: ids.device,
    model: 'Solunar periods',
    should_poll: false,
    params: [],
    features: [
      text('period'),
      sensor(names.active, ids.feature('active'), CATEGORIES.INPUT, TYPES.INPUT.BINARY, {
        max: 1,
      }),
      text('next_period'),
      sensor(names.next_in, ids.feature('next_in'), CATEGORIES.DURATION, TYPES.DURATION.INTEGER, {
        unit: UNITS.MINUTES,
        max: NEXT_IN_MAX,
        keep_history: false,
      }),
      sensor(names.rating, ids.feature('rating'), CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
        max: 4,
      }),
      text('moon_phase'),
      sensor(
        names.illumination,
        ids.feature('illumination'),
        CATEGORIES.COUNTER_SENSOR,
        TYPES.SENSOR.INTEGER,
        { max: 100 },
      ),
    ],
  };
}
