// Pure classification rules (requirements §4). No DOM, no dates: input is the
// list of hours of one window (a block, or the 06–24 day window).
import type { Cell, Hour, Severity } from './types';
import * as T from './thresholds';

const RANK: Record<Severity, number> = { none: -1, ok: 0, marginal: 1, poor: 2 };

export function worse(a: Severity, b: Severity): Severity {
  return RANK[a] >= RANK[b] ? a : b;
}

const noData: Cell = { severity: 'none', label: '–', short: '–' };

function values(hours: Hour[], key: keyof Hour): number[] {
  return hours.map((h) => h[key]).filter((v): v is number => typeof v === 'number');
}

/** "2.4", "14": one decimal below 10, whole numbers above. */
export function formatMm(v: number): string {
  return v < 10 ? v.toFixed(1) : String(Math.round(v));
}

// ---------- Rain ----------

export function classifyRain(hours: Hour[]): Cell {
  const amounts = values(hours, 'precip');
  if (amounts.length === 0) return noData;
  const peak = Math.max(...amounts);
  const rainy = amounts.filter((v) => v >= T.RAINY_HOUR_MM).length;
  const detail = `peak ${formatMm(peak)} mm/h`;

  if (peak < T.DRIZZLE_HOUR_MM) return { severity: 'ok', label: 'Dry', short: 'Dry' };
  if (rainy === 0) return { severity: 'ok', label: 'Drizzle', short: 'Drizzle' };
  if (peak >= T.RAIN_PEAK_POOR) return { severity: 'poor', label: 'Bursts', detail, short: 'Bursts' };
  if (rainy / amounts.length >= T.PERSISTENT_SHARE) {
    return { severity: 'marginal', label: 'Persistent', detail, short: 'Persistent' };
  }
  const severity: Severity = peak >= T.RAIN_PEAK_MARGINAL ? 'marginal' : 'ok';
  return { severity, label: 'Showers', detail, short: 'Showers' };
}

// ---------- Storms ----------

export function classifyStorms(hours: Hour[]): Cell {
  const known = hours.filter((h) => h.code !== null || h.cape !== null);
  if (known.length === 0) return noData;

  const thunder = hours.filter((h) => h.code !== null && T.THUNDER_CODES.includes(h.code));
  if (thunder.length > 0) {
    const first = thunder[0].hour;
    const last = thunder[thunder.length - 1].hour + 1;
    const detail = `${pad(first)}–${pad(last)}`;
    return { severity: 'poor', label: 'Likely', detail, short: 'Likely' };
  }
  const possible = hours.some(
    (h) => h.precip !== null && h.precip >= T.RAINY_HOUR_MM && h.cape !== null && h.cape >= T.STORM_CAPE,
  );
  if (possible) return { severity: 'marginal', label: 'Possible', short: 'Possible' };
  return { severity: 'ok', label: 'None', short: 'None' };
}

function pad(h: number): string {
  return String(h).padStart(2, '0');
}

// ---------- Wind ----------

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * Direction of the strongest hour: the hour with the highest sustained wind
 * (the earliest one on a tie), or the highest gust when there is no sustained
 * wind data. Null when that hour has no direction.
 */
export function strongestDirection(hours: Hour[]): number | null {
  const bySpeed = hours.filter((h) => h.wind !== null);
  const pool = bySpeed.length ? bySpeed : hours.filter((h) => h.gust !== null);
  const key = bySpeed.length ? 'wind' : 'gust';
  let best: Hour | null = null;
  for (const h of pool) if (best === null || (h[key] as number) > (best[key] as number)) best = h;
  return best?.dir ?? null;
}

export function classifyWind(hours: Hour[]): Cell {
  const speeds = values(hours, 'wind');
  const gusts = values(hours, 'gust');
  if (speeds.length === 0 && gusts.length === 0) return noData;
  const sustained = speeds.length ? Math.max(...speeds) : null;
  const gust = gusts.length ? Math.max(...gusts) : null;

  let severity: Severity = 'ok';
  if ((sustained ?? 0) >= T.WIND_MARGINAL || (gust ?? 0) >= T.GUST_MARGINAL) severity = 'marginal';
  if ((sustained ?? 0) >= T.WIND_POOR || (gust ?? 0) >= T.GUST_POOR) severity = 'poor';
  if (severity === 'ok') return { severity, label: 'OK', short: 'OK' };

  const dir = strongestDirection(hours);
  const parts: string[] = [];
  if (sustained !== null) parts.push(`${Math.round(sustained)} km/h`);
  if (dir !== null) parts.push(compass(dir));
  if (gust !== null) parts.push(`gusts ${Math.round(gust)}`);
  const short = sustained !== null ? `${Math.round(sustained)} km/h` : `gusts ${Math.round(gust!)}`;
  return { severity, label: 'Wind', detail: parts.join(' '), short };
}

// ---------- Waves ----------

interface WaveHour {
  severity: Severity;
  steep: boolean;
  h: number;
  t: number | null;
}

export function classifyWaveHour(h: number, t: number | null): WaveHour {
  let height: Severity = 'ok';
  if (h >= T.WAVE_MARGINAL) height = 'marginal';
  if (h >= T.WAVE_POOR) height = 'poor';

  let steep: Severity = 'ok';
  if (t !== null && t < T.STEEP_FACTOR * h) {
    if (h >= T.STEEP_MARGINAL) steep = 'marginal';
    if (h >= T.STEEP_POOR) steep = 'poor';
  }
  const severity = worse(height, steep);
  return { severity, steep: severity !== 'ok' && steep === severity, h, t };
}

export function classifyWaves(hours: Hour[]): Cell {
  const rated: WaveHour[] = [];
  for (const hr of hours) {
    if (hr.waveH !== null) rated.push(classifyWaveHour(hr.waveH, hr.waveT));
  }
  if (rated.length === 0) return noData;

  // Worst hour; among equals the highest wave.
  let worst = rated[0];
  for (const r of rated) {
    if (RANK[r.severity] > RANK[worst.severity] || (r.severity === worst.severity && r.h > worst.h)) worst = r;
  }
  if (worst.severity === 'ok') return { severity: 'ok', label: 'OK', short: 'OK' };

  const height = `${worst.h.toFixed(1)} m`;
  if (worst.steep && worst.t !== null) {
    return {
      severity: worst.severity,
      label: 'Choppy',
      detail: `${height} every ${Math.round(worst.t)} s`,
      short: height,
    };
  }
  return { severity: worst.severity, label: 'Big waves', detail: height, short: height };
}

export interface WindowCells {
  rain: Cell;
  storms: Cell;
  wind: Cell;
  waves: Cell;
}

/** The four metrics in display order: rows of a day grid, columns of the outlook. */
export const METRICS = [
  { key: 'rain', name: 'Rain' },
  { key: 'storms', name: 'Storms' },
  { key: 'wind', name: 'Wind' },
  { key: 'waves', name: 'Waves' },
] as const satisfies readonly { key: keyof WindowCells; name: string }[];

export function classifyWindow(hours: Hour[]): WindowCells {
  return {
    rain: classifyRain(hours),
    storms: classifyStorms(hours),
    wind: classifyWind(hours),
    waves: classifyWaves(hours),
  };
}
