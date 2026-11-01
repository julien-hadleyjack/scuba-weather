// Text alternative for the hourly chart (NFR-3).
import { DRIZZLE_HOUR_MM } from './thresholds';
import { formatMm } from './classify';
import { pad2 } from './time';
import type { ChartHour } from './dashboard';

export function describeBlock(
  name: string,
  rain: ChartHour[],
  tide: (number | null)[],
  night: [number, number][],
  start: number,
  end: number,
): string {
  const parts: string[] = [];

  const wet = rain.filter((h) => h.precip !== null && h.precip >= DRIZZLE_HOUR_MM);
  if (rain.every((h) => h.precip === null)) parts.push('no rain data');
  else if (wet.length === 0) parts.push('dry');
  else {
    const peak = wet.reduce((a, b) => ((b.precip ?? 0) > (a.precip ?? 0) ? b : a));
    parts.push(`rain in ${wet.length} of ${rain.length} hours, peak ${formatMm(peak.precip!)} mm/h at ${pad2(peak.hour)}:00`);
  }

  const t = tide.filter((v): v is number => v !== null);
  if (t.length >= 2) {
    const d = t[t.length - 1] - t[0];
    parts.push(Math.abs(d) < 0.1 ? 'tide about steady' : d > 0 ? 'tide rising' : 'tide falling');
  }

  const dark = night.some(([a, b]) => Math.min(b, end) > Math.max(a, start));
  if (dark) {
    const all = night.some(([a, b]) => a <= start && b >= end);
    parts.push(all ? 'dark' : 'partly dark');
  }

  return `${name}: ${parts.join(', ')}`;
}
