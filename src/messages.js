// -----------------------------------------------------------------------------
// Texts sent from the container (feature names and values, connection status,
// action and scene messages, scene variables, widget), in the four languages
// of the Gladys interface. Entries are strings or functions of one parameter
// object. German says "du", Spanish "usted".
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

// Spanish: "a la 01:10", "a las 13:10".
const article = (time) => (time.startsWith('01:') ? 'la' : 'las');

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    house: 'Solunar',
    spot: 'Fishing spot',
    period: 'Solunar period',
    active: 'Solunar period active',
    next_period: 'Next solunar period',
    next_in: 'Next period in (min)',
    rating: 'Day rating (0-4)',
    moon_phase: 'Moon phase',
    illumination: 'Moon illumination (%)',
  },
  fr: {
    house: 'Solunaire',
    spot: 'Coin de pêche',
    period: 'Période solunaire',
    active: 'Période solunaire active',
    next_period: 'Prochaine période solunaire',
    next_in: 'Prochaine période dans (min)',
    rating: 'Note du jour (0-4)',
    moon_phase: 'Phase de la lune',
    illumination: 'Illumination de la lune (%)',
  },
  de: {
    house: 'Solunar',
    spot: 'Angelplatz',
    period: 'Solunar-Periode',
    active: 'Solunar-Periode aktiv',
    next_period: 'Nächste Solunar-Periode',
    next_in: 'Nächste Periode in (min)',
    rating: 'Tagesbewertung (0-4)',
    moon_phase: 'Mondphase',
    illumination: 'Mondbeleuchtung (%)',
  },
  es: {
    house: 'Solunar',
    spot: 'Lugar de pesca',
    period: 'Periodo solunar',
    active: 'Periodo solunar activo',
    next_period: 'Próximo periodo solunar',
    next_in: 'Próximo periodo en (min)',
    rating: 'Nota del día (0-4)',
    moon_phase: 'Fase lunar',
    illumination: 'Iluminación lunar (%)',
  },
};

export const KIND_NAMES = {
  en: { none: 'None', major: 'Major', minor: 'Minor' },
  fr: { none: 'Aucune', major: 'Majeure', minor: 'Mineure' },
  de: { none: 'Keine', major: 'Hauptperiode', minor: 'Nebenperiode' },
  es: { none: 'Ninguno', major: 'Mayor', minor: 'Menor' },
};

export const EVENT_NAMES = {
  en: {
    upper_transit: 'Moon overhead',
    lower_transit: 'Moon underfoot',
    moonrise: 'Moonrise',
    moonset: 'Moonset',
  },
  fr: {
    upper_transit: 'Lune au zénith',
    lower_transit: 'Lune au nadir',
    moonrise: 'Lever de lune',
    moonset: 'Coucher de lune',
  },
  de: {
    upper_transit: 'Mond im Zenit',
    lower_transit: 'Mond im Nadir',
    moonrise: 'Mondaufgang',
    moonset: 'Monduntergang',
  },
  es: {
    upper_transit: 'Luna en el cenit',
    lower_transit: 'Luna en el nadir',
    moonrise: 'Salida de la luna',
    moonset: 'Puesta de la luna',
  },
};

export const PHASE_NAMES = {
  en: {
    new_moon: 'New moon',
    waxing_crescent: 'Waxing crescent',
    first_quarter: 'First quarter',
    waxing_gibbous: 'Waxing gibbous',
    full_moon: 'Full moon',
    waning_gibbous: 'Waning gibbous',
    last_quarter: 'Last quarter',
    waning_crescent: 'Waning crescent',
  },
  fr: {
    new_moon: 'Nouvelle lune',
    waxing_crescent: 'Premier croissant',
    first_quarter: 'Premier quartier',
    waxing_gibbous: 'Gibbeuse croissante',
    full_moon: 'Pleine lune',
    waning_gibbous: 'Gibbeuse décroissante',
    last_quarter: 'Dernier quartier',
    waning_crescent: 'Dernier croissant',
  },
  de: {
    new_moon: 'Neumond',
    waxing_crescent: 'Zunehmende Sichel',
    first_quarter: 'Erstes Viertel',
    waxing_gibbous: 'Zunehmender Mond',
    full_moon: 'Vollmond',
    waning_gibbous: 'Abnehmender Mond',
    last_quarter: 'Letztes Viertel',
    waning_crescent: 'Abnehmende Sichel',
  },
  es: {
    new_moon: 'Luna nueva',
    waxing_crescent: 'Luna creciente',
    first_quarter: 'Cuarto creciente',
    waxing_gibbous: 'Gibosa creciente',
    full_moon: 'Luna llena',
    waning_gibbous: 'Gibosa menguante',
    last_quarter: 'Cuarto menguante',
    waning_crescent: 'Luna menguante',
  },
};

export const RATING_NAMES = {
  en: ['Poor', 'Fair', 'Average', 'Good', 'Excellent'],
  fr: ['Faible', 'Passable', 'Moyenne', 'Bonne', 'Excellente'],
  de: ['Schwach', 'Mäßig', 'Mittel', 'Gut', 'Ausgezeichnet'],
  es: ['Baja', 'Regular', 'Media', 'Buena', 'Excelente'],
};

// Sentences. `kind` is a KIND_NAMES entry already translated.
export const PHRASES = {
  en: {
    current: ({ kind, end }) => `${kind} until ${end}`,
    next: ({ kind, start, tomorrow }) => `${kind} ${tomorrow ? 'tomorrow ' : ''}at ${start}`,
    range: ({ start, end }) => `${start}–${end}`,
    started: ({ kind, place, start, end, sun }) =>
      `${kind} solunar period (${place}), ${start}–${end}${sun ? ', with the sun' : ''}.`,
    day: ({ place, rating, periods, phase }) =>
      `${place}: ${rating} day. ${periods || 'No solunar period'}. ${phase}.`,
    sun: 'with the sun',
  },
  fr: {
    current: ({ kind, end }) => `${kind} jusqu'à ${end}`,
    next: ({ kind, start, tomorrow }) => `${kind} ${tomorrow ? 'demain ' : ''}à ${start}`,
    range: ({ start, end }) => `${start}–${end}`,
    started: ({ kind, place, start, end, sun }) =>
      `Période solunaire ${kind.toLowerCase()} (${place}), ${start}–${end}${sun ? ', avec le soleil' : ''}.`,
    day: ({ place, rating, periods, phase }) =>
      `${place} : journée ${rating.toLowerCase()}. ${periods || 'Aucune période solunaire'}. ${phase}.`,
    sun: 'avec le soleil',
  },
  de: {
    current: ({ kind, end }) => `${kind} bis ${end}`,
    next: ({ kind, start, tomorrow }) => `${kind} ${tomorrow ? 'morgen ' : ''}um ${start}`,
    range: ({ start, end }) => `${start}–${end}`,
    started: ({ kind, place, start, end, sun }) =>
      `Solunar-${kind} (${place}), ${start}–${end}${sun ? ', mit der Sonne' : ''}.`,
    day: ({ place, rating, periods, phase }) =>
      `${place}: Tagesnote ${rating}. ${periods || 'Keine Solunar-Periode'}. ${phase}.`,
    sun: 'mit der Sonne',
  },
  es: {
    current: ({ kind, end }) => `${kind} hasta ${article(end)} ${end}`,
    next: ({ kind, start, tomorrow }) =>
      `${kind} ${tomorrow ? 'mañana ' : ''}a ${article(start)} ${start}`,
    range: ({ start, end }) => `${start}–${end}`,
    started: ({ kind, place, start, end, sun }) =>
      `Periodo solunar ${kind.toLowerCase()} (${place}), ${start}–${end}${sun ? ', con el sol' : ''}.`,
    day: ({ place, rating, periods, phase }) =>
      `${place}: nota del día ${rating.toLowerCase()}. ${periods || 'Ningún periodo solunar'}. ${phase}.`,
    sun: 'con el sol',
  },
};

// Connection status and action messages.
export const STATUS = {
  en: {
    noPlace:
      'No place to compute: locate a house in Gladys (Settings → Houses) or type the coordinates of a fishing spot.',
    invalidSpot: ({ slots }) =>
      `Unreadable coordinates for spot ${slots}: type "latitude, longitude", e.g. 43.6047, 1.4442.`,
    initFailed: 'The integration could not start: see its logs.',
    noDevice: 'Pick a place created in Gladys.',
    check: ({ count, list }) => `${count} place(s): ${list}`,
  },
  fr: {
    noPlace:
      'Aucun lieu à calculer : localisez une maison dans Gladys (Paramètres → Maisons) ou saisissez les coordonnées d’un coin de pêche.',
    invalidSpot: ({ slots }) =>
      `Coordonnées illisibles pour le coin ${slots} : saisissez « latitude, longitude », par ex. 43.6047, 1.4442.`,
    initFailed: 'L’intégration n’a pas pu démarrer : voyez ses journaux.',
    noDevice: 'Choisissez un lieu créé dans Gladys.',
    check: ({ count, list }) => `${count} lieu(x) : ${list}`,
  },
  de: {
    noPlace:
      'Kein Ort zu berechnen: Verorte ein Haus in Gladys (Einstellungen → Häuser) oder gib die Koordinaten eines Angelplatzes ein.',
    invalidSpot: ({ slots }) =>
      `Unlesbare Koordinaten für Platz ${slots}: gib „Breite, Länge“ ein, z. B. 43.6047, 1.4442.`,
    initFailed: 'Die Integration konnte nicht starten: sieh in ihre Protokolle.',
    noDevice: 'Wähle einen in Gladys angelegten Ort.',
    check: ({ count, list }) => `${count} Ort(e): ${list}`,
  },
  es: {
    noPlace:
      'Ningún lugar que calcular: ubique una casa en Gladys (Ajustes → Casas) o escriba las coordenadas de un lugar de pesca.',
    invalidSpot: ({ slots }) =>
      `Coordenadas ilegibles para el lugar ${slots}: escriba «latitud, longitud», p. ej. 43.6047, 1.4442.`,
    initFailed: 'La integración no pudo arrancar: consulte sus registros.',
    noDevice: 'Elija un lugar creado en Gladys.',
    check: ({ count, list }) => `${count} lugar(es): ${list}`,
  },
};

// Widget texts.
export const WIDGET_TEXT = {
  en: {
    rating: 'Day rating',
    moon: 'Moon',
    running: 'Now',
    past: 'Past',
    coming: 'Coming',
    none: 'No solunar period today',
    pick: 'Pick a place in the settings',
    sun: '☀ sunrise/sunset',
  },
  fr: {
    rating: 'Note du jour',
    moon: 'Lune',
    running: 'En cours',
    past: 'Passée',
    coming: 'À venir',
    none: 'Aucune période aujourd’hui',
    pick: 'Choisissez un lieu dans les réglages',
    sun: '☀ lever/coucher du soleil',
  },
  de: {
    rating: 'Tagesnote',
    moon: 'Mond',
    running: 'Läuft',
    past: 'Vorbei',
    coming: 'Kommt',
    none: 'Heute keine Periode',
    pick: 'Wähle einen Ort in den Einstellungen',
    sun: '☀ Sonnenauf-/untergang',
  },
  es: {
    rating: 'Nota del día',
    moon: 'Luna',
    running: 'En curso',
    past: 'Pasado',
    coming: 'Próximo',
    none: 'Ningún periodo hoy',
    pick: 'Elija un lugar en los ajustes',
    sun: '☀ salida/puesta del sol',
  },
};

/** One entry of a table in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}
