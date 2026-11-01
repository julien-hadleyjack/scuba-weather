// Open-Meteo clients (DATA-1, DATA-2, SPOT-2, SPOT-5). No API key needed.
// 6 forecast days: a forecast up to 12 h old (the most we show) still covers
// today + tomorrow + the three outlook days after a date change at the spot.
import { REQUEST_TIMEOUT_MS } from './thresholds';
import type { DayInfo, Forecast, Hour, Place, Spot } from './types';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

type Fetch = typeof fetch;

interface ForecastResponse {
  timezone: string;
  utc_offset_seconds: number;
  hourly: {
    time: string[];
    precipitation: (number | null)[];
    weather_code: (number | null)[];
    cape: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
  };
  daily: { time: string[]; sunrise: (string | null)[]; sunset: (string | null)[] };
}

interface MarineResponse {
  hourly: {
    time: string[];
    wave_height: (number | null)[];
    wave_period: (number | null)[];
    sea_level_height_msl: (number | null)[];
    sea_surface_temperature: (number | null)[];
  };
}

function round(n: number): string {
  return n.toFixed(4);
}

export function forecastUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    latitude: round(lat),
    longitude: round(lon),
    hourly: 'precipitation,weather_code,cape,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    wind_speed_unit: 'kmh',
    forecast_days: '6',
  });
  return `${FORECAST_URL}?${p}`;
}

export function marineUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    latitude: round(lat),
    longitude: round(lon),
    hourly: 'wave_height,wave_period,sea_level_height_msl,sea_surface_temperature',
    timezone: 'auto',
    forecast_days: '6',
  });
  return `${MARINE_URL}?${p}`;
}

async function getJson<T>(url: string, f: Fetch, signal?: AbortSignal): Promise<T> {
  const res = await f(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body && body.error) throw new Error(body.reason ?? 'API error');
  return body as T;
}

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Merge both responses into one hourly list keyed by local time.
 *
 * Every `Hour` describes the hour that starts at its time (06:00 = 06:00–06:59,
 * DATA-9). Open-Meteo gives `precipitation` as the sum and `wind_gusts_10m` as
 * the maximum of the *preceding* hour, so those two are read from the next
 * timestamp; all other variables are instant values at the timestamp itself.
 * The last hour of the forecast has no next timestamp and gets null.
 */
export function parseForecast(
  spot: Pick<Spot, 'latitude' | 'longitude'>,
  fc: ForecastResponse,
  marine: MarineResponse,
  fetchedAt: number,
): Forecast {
  const sea = new Map<string, number>();
  marine.hourly.time.forEach((t, i) => sea.set(t, i));

  const hours: Hour[] = fc.hourly.time.map((time, i) => {
    const m = sea.get(time);
    const mv = (arr: (number | null)[]) => (m === undefined ? null : num(arr[m]));
    return {
      time,
      date: time.slice(0, 10),
      hour: Number(time.slice(11, 13)),
      precip: num(fc.hourly.precipitation[i + 1]),
      code: num(fc.hourly.weather_code[i]),
      cape: num(fc.hourly.cape[i]),
      wind: num(fc.hourly.wind_speed_10m[i]),
      gust: num(fc.hourly.wind_gusts_10m[i + 1]),
      dir: num(fc.hourly.wind_direction_10m[i]),
      waveH: mv(marine.hourly.wave_height),
      waveT: mv(marine.hourly.wave_period),
      seaLevel: mv(marine.hourly.sea_level_height_msl),
      sst: mv(marine.hourly.sea_surface_temperature),
    };
  });

  const days: DayInfo[] = fc.daily.time.map((date, i) => ({
    date,
    sunrise: fc.daily.sunrise[i] ?? null,
    sunset: fc.daily.sunset[i] ?? null,
  }));

  return {
    latitude: spot.latitude,
    longitude: spot.longitude,
    timezone: fc.timezone,
    utcOffsetSeconds: fc.utc_offset_seconds,
    fetchedAt,
    hours,
    days,
  };
}

/**
 * Both requests in parallel; fails unless both succeed within the timeout
 * (DATA-3). On failure or timeout the other request is cancelled.
 */
export async function fetchForecast(
  spot: Spot,
  f: Fetch = fetch,
  now = Date.now,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Forecast> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
  });
  try {
    const [fc, marine] = await Promise.race([
      Promise.all([
        getJson<ForecastResponse>(forecastUrl(spot.latitude, spot.longitude), f, ctrl.signal),
        getJson<MarineResponse>(marineUrl(spot.latitude, spot.longitude), f, ctrl.signal),
      ]),
      timeout,
    ]);
    return parseForecast(spot, fc, marine, now());
  } catch (e) {
    ctrl.abort();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  admin2?: string;
  country?: string;
}

function unique(parts: (string | undefined)[], name: string): string[] {
  const out: string[] = [];
  for (const p of parts) if (p && p !== name && !out.includes(p)) out.push(p);
  return out;
}

export async function searchPlaces(query: string, signal?: AbortSignal, f: Fetch = fetch): Promise<Place[]> {
  const p = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
  const body = await getJson<{ results?: GeoResult[] }>(`${GEOCODING_URL}?${p}`, f, signal);
  return (body.results ?? []).slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name,
    region: unique([r.admin1, r.country], r.name).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/** True when the Marine API has sea values for the point, false on land (SPOT-5). */
export async function isOnWater(lat: number, lon: number, signal?: AbortSignal, f: Fetch = fetch): Promise<boolean> {
  const p = new URLSearchParams({
    latitude: round(lat),
    longitude: round(lon),
    current: 'wave_height',
  });
  const body = await getJson<{ current?: { wave_height?: number | null } }>(`${MARINE_URL}?${p}`, f, signal);
  return num(body.current?.wave_height) !== null;
}
