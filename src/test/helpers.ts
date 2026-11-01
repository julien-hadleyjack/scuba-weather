import type { Forecast, Hour } from '../lib/types';
import { addDays } from '../lib/time';

export function hour(partial: Partial<Hour> = {}): Hour {
  return {
    time: '2026-11-01T06:00',
    date: '2026-11-01',
    hour: 6,
    precip: 0,
    code: 0,
    cape: 0,
    wind: 5,
    gust: 10,
    dir: 180,
    waveH: 0.3,
    waveT: 8,
    seaLevel: 0,
    sst: 29,
    ...partial,
  };
}

/** n hours with the given overrides, hour numbers starting at `start`. */
export function hours(n: number, partial: Partial<Hour> | ((i: number) => Partial<Hour>), start = 6): Hour[] {
  return Array.from({ length: n }, (_, i) => {
    const p = typeof partial === 'function' ? partial(i) : partial;
    const h = start + i;
    return hour({ hour: h, time: `2026-11-01T${String(h).padStart(2, '0')}:00`, ...p });
  });
}

/** A calm 5-day forecast for a spot in Asia/Bangkok (UTC+7). */
export function forecast(
  firstDate = '2026-11-01',
  days = 5,
  tweak: (h: Hour) => Partial<Hour> = () => ({}),
): Forecast {
  const hrs: Hour[] = [];
  const dayInfo = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(firstDate, d);
    dayInfo.push({ date, sunrise: `${date}T06:10`, sunset: `${date}T17:55` });
    for (let h = 0; h < 24; h++) {
      const base = hour({
        date,
        hour: h,
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        seaLevel: Math.sin((h / 12.4) * 2 * Math.PI),
      });
      hrs.push({ ...base, ...tweak(base) });
    }
  }
  return {
    latitude: 10,
    longitude: 99.8,
    timezone: 'Asia/Bangkok',
    utcOffsetSeconds: 7 * 3600,
    fetchedAt: Date.UTC(2026, 10, 1, 0, 0),
    hours: hrs,
    days: dayInfo,
  };
}
