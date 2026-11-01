// Spot and last forecast on the device (SPOT-8, OFF-2).
import type { Forecast, Spot } from './types';

const SPOT_KEY = 'scuba-weather.spot.v1';
const FORECAST_KEY = 'scuba-weather.forecast.v1';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works for this session.
  }
}

export function loadSpot(): Spot | null {
  const s = read<Spot>(SPOT_KEY);
  return s && typeof s.latitude === 'number' && typeof s.longitude === 'number' ? s : null;
}

export function saveSpot(spot: Spot): void {
  write(SPOT_KEY, spot);
  // A new spot invalidates the stored forecast.
  const f = loadForecast();
  if (f && !sameSpot(f, spot)) {
    try {
      localStorage.removeItem(FORECAST_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function loadForecast(): Forecast | null {
  const f = read<Forecast>(FORECAST_KEY);
  return f && Array.isArray(f.hours) && typeof f.fetchedAt === 'number' ? f : null;
}

export function saveForecast(f: Forecast): void {
  write(FORECAST_KEY, f);
}

export function sameSpot(f: Pick<Forecast, 'latitude' | 'longitude'>, s: Pick<Spot, 'latitude' | 'longitude'>): boolean {
  return Math.abs(f.latitude - s.latitude) < 1e-6 && Math.abs(f.longitude - s.longitude) < 1e-6;
}
