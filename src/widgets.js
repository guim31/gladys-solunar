// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `solunar_day`, the
// solunar periods of today for one place.
//
// Two tiles (the day rating, the moon illumination, which `show_moon` hides),
// one status row per period of the day (2 to 4), green while it runs, grey
// once past, ☀ when it meets a sunrise or a sunset, then a caption with the
// place name and the moon phase. Budget: 2 values, 1 status, 1 text.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { KIND_NAMES, PHASE_NAMES, RATING_NAMES, WIDGET_TEXT } from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { formatTime } from './time.js';

export const TTL_SECONDS = 300;

/** The place a widget shows: the chosen device, else the first place. */
function pickPlace(monitor, settings) {
  const chosen = settings?.device ? monitor.placeOf(settings.device) : null;
  if (chosen) {
    return chosen;
  }
  return settings?.device ? null : (monitor.places[0] ?? null);
}

/** The content of the widget for one language. */
export function content(monitor, { language = 'en', settings = {} } = {}) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const text = WIDGET_TEXT[lang];
  const place = pickPlace(monitor, settings);
  if (place === null) {
    return { ttl_seconds: 60, components: [{ type: 'text', variant: 'caption', text: text.pick }] };
  }
  const at = monitor.now();
  const { today, moon } = monitor.snapshot(place, at);
  const time = (ms) => formatTime(ms, lang, monitor.timeZone);
  const items = today.periods.map((period) => {
    const running = period.start <= at && at < period.end;
    const past = period.end <= at;
    return {
      label: `${KIND_NAMES[lang][period.kind]} ${time(period.start)}–${time(period.end)}${period.enhanced ? ' ☀' : ''}`,
      value: running ? text.running : past ? text.past : text.coming,
      color: running
        ? WIDGET_COLORS.SUCCESS
        : past
          ? WIDGET_COLORS.NEUTRAL
          : period.kind === 'major'
            ? WIDGET_COLORS.PRIMARY
            : WIDGET_COLORS.INFO,
      icon: period.kind === 'major' ? 'star' : 'moon',
    };
  });
  const showMoon = settings?.show_moon !== false && settings?.show_moon !== 'false';
  // The place, the rating in words, the phase, and the ☀ legend when needed
  // (dropped first when a long place name leaves no room).
  const parts = [
    monitor.displayName(place),
    RATING_NAMES[lang][today.rating],
    showMoon ? PHASE_NAMES[lang][moon.phase] : null,
  ].filter(Boolean);
  const legend = today.periods.some((p) => p.enhanced) ? text.sun : null;
  const withLegend = [...parts, legend].filter(Boolean).join(' · ');
  const caption = (withLegend.length <= 80 ? withLegend : parts.join(' · ')).slice(0, 80);
  const components = [
    {
      type: 'value',
      label: text.rating,
      value: `${today.rating}/4`,
      icon: 'award',
      color: today.rating >= 3 ? WIDGET_COLORS.SUCCESS : undefined,
    },
  ];
  if (showMoon) {
    components.push({
      type: 'value',
      label: text.moon,
      value: Math.round(moon.illumination),
      unit: '%',
      icon: 'moon',
    });
  }
  components.push(
    items.length > 0
      ? { type: 'status', items }
      : { type: 'text', variant: 'body', text: text.none },
    { type: 'text', variant: 'caption', text: caption },
  );
  // A tile's colour is optional: leave the key out rather than undefined.
  for (const component of components) {
    if (component.color === undefined) {
      delete component.color;
    }
  }
  return { ttl_seconds: TTL_SECONDS, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, request = {}) {
      return content(monitor, request);
    },
  },
};
