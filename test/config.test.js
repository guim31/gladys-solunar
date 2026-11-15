import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseCoordinates } from '../src/config.js';

test('coordinates: points, decimal commas, semicolons, blanks', () => {
  const expected = { latitude: 43.6047, longitude: 1.4442 };
  for (const text of [
    '43.6047, 1.4442',
    '43.6047,1.4442',
    ' 43.6047 1.4442 ',
    '43,6047; 1,4442',
    '43,6047, 1,4442',
    '43,6047 1,4442',
  ]) {
    assert.deepEqual(parseCoordinates(text), expected, text);
  }
  assert.deepEqual(parseCoordinates('-33.86, -151.2'), { latitude: -33.86, longitude: -151.2 });
});

test('coordinates: unreadable or out of range', () => {
  for (const text of [
    '',
    'Toulouse',
    '43.6',
    '95, 10',
    '43, 200',
    '1, 2, 3',
    'a, b',
    '43.6,',
    '43.6; ',
    '0x10, 1e1',
  ]) {
    assert.equal(parseCoordinates(text), null, text);
  }
});

test('defaults: French, the houses, no spot', () => {
  assert.deepEqual(normalizeConfig({}), {
    language: 'fr',
    useHouses: true,
    spots: [],
    invalidSpots: [],
  });
  assert.equal(normalizeConfig(null).language, 'fr');
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
});

test('spots: kept by slot, unreadable ones reported, names optional', () => {
  const config = normalizeConfig({
    language: 'de',
    use_houses: false,
    spot_1_name: '  Bodensee ',
    spot_1_coordinates: '47.63, 9.37',
    spot_2_name: 'Nowhere',
    spot_2_coordinates: 'north of the bridge',
    spot_3_coordinates: '44.42; -79.37',
  });
  assert.equal(config.useHouses, false);
  assert.deepEqual(config.spots, [
    { slot: 1, name: 'Bodensee', latitude: 47.63, longitude: 9.37 },
    { slot: 3, name: null, latitude: 44.42, longitude: -79.37 },
  ]);
  assert.deepEqual(config.invalidSpots, [2]);
  assert.equal(normalizeConfig({ use_houses: 'false' }).useHouses, false);
});
