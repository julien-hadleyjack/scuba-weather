// Turns a stored forecast into what the dashboard shows. Pure: "now" is an input.
import { classifyWindow, type WindowCells } from './classify';
import { BLOCKS, DAY_END, DAY_START } from './thresholds';
import { addDays, fractionalHour, localTime, type LocalTime } from './time';
import type { Forecast, Hour } from './types';

export interface BlockView {
  id: string;
  name: string;
  start: number;
  end: number;
  past: boolean;
  cells: WindowCells;
}

export interface ChartHour {
  hour: number;
  precip: number | null;
}

export interface DayChart {
  /** Rain per hour, 06…21. */
  hours: ChartHour[];
  /** Tide, scaled 0 (day's low) … 1 (day's high) at each hour 06…24 (24 = next day 00:00); null = no data. */
  tide: (number | null)[];
  /** Night ranges in fractional local hours, clipped to 06–24. */
  night: [number, number][];
}

export interface DayView {
  date: string;
  blocks: BlockView[];
  chart: DayChart;
  /** Rounded mean sea surface temperature 06–24, or null. */
  water: number | null;
}

export interface OutlookRow {
  date: string;
  cells: WindowCells;
}

export interface DashboardView {
  now: LocalTime;
  today: DayView;
  tomorrow: DayView | null;
  outlook: OutlookRow[];
}

function hoursOf(forecast: Forecast, date: string): Hour[] {
  return forecast.hours.filter((h) => h.date === date);
}

function window(hours: Hour[], start: number, end: number): Hour[] {
  return hours.filter((h) => h.hour >= start && h.hour < end);
}

/** A block is over once its last hour has ended (DASH-9). */
export function isPast(date: string, end: number, now: LocalTime): boolean {
  if (date < now.date) return true;
  if (date > now.date) return false;
  return now.hour >= end;
}

export function buildDay(forecast: Forecast, date: string, now: LocalTime): DayView {
  const all = hoursOf(forecast, date);
  const blocks: BlockView[] = BLOCKS.map((b) => ({
    id: b.id,
    name: b.name,
    start: b.start,
    end: b.end,
    past: isPast(date, b.end, now),
    cells: classifyWindow(window(all, b.start, b.end)),
  }));

  const byHour = new Map(all.map((h) => [h.hour, h]));
  const hours: ChartHour[] = [];
  for (let h = DAY_START; h < DAY_END; h++) hours.push({ hour: h, precip: byHour.get(h)?.precip ?? null });

  // Tide at 06 … 24, where 24 is the next day's 00:00. Scaled between the
  // lowest and highest sea level of the calendar day (plus that end point).
  const midnight = forecast.hours.find((h) => h.date === addDays(date, 1) && h.hour === 0)?.seaLevel ?? null;
  const at = (h: number) => (h === 24 ? midnight : (byHour.get(h)?.seaLevel ?? null));
  const levels = [...all.map((h) => h.seaLevel), midnight].filter((v): v is number => v !== null);
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  const tide: (number | null)[] = [];
  for (let h = DAY_START; h <= DAY_END; h++) {
    const v = at(h);
    tide.push(v === null ? null : hi - lo < 1e-6 ? 0.5 : (v - lo) / (hi - lo));
  }

  const info = forecast.days.find((d) => d.date === date);
  const night: [number, number][] = [];
  if (info?.sunrise && info?.sunset) {
    const rise = fractionalHour(info.sunrise, date);
    const set = fractionalHour(info.sunset, date);
    if (rise > DAY_START) night.push([DAY_START, Math.min(rise, DAY_END)]);
    if (set < DAY_END) night.push([Math.max(set, DAY_START), DAY_END]);
  }

  const sst = window(all, DAY_START, DAY_END)
    .map((h) => h.sst)
    .filter((v): v is number => v !== null);
  const water = sst.length ? Math.round(sst.reduce((a, b) => a + b, 0) / sst.length) : null;

  return { date, blocks, chart: { hours, tide, night }, water };
}

function hasDay(forecast: Forecast, date: string): boolean {
  return forecast.hours.some((h) => h.date === date && h.hour >= DAY_START && h.hour < DAY_END);
}

/**
 * Build the dashboard for the spot's current date (DATA-5). Returns null when
 * the stored forecast no longer covers today (OFF-5).
 */
export function buildDashboard(forecast: Forecast, nowMs: number): DashboardView | null {
  const now = localTime(nowMs, forecast.timezone, forecast.utcOffsetSeconds);
  if (!hasDay(forecast, now.date)) return null;
  const tomorrowDate = addDays(now.date, 1);
  const outlook: OutlookRow[] = [];
  for (let i = 2; i <= 4; i++) {
    const date = addDays(now.date, i);
    if (!hasDay(forecast, date)) continue;
    outlook.push({ date, cells: classifyWindow(window(hoursOf(forecast, date), DAY_START, DAY_END)) });
  }
  return {
    now,
    today: buildDay(forecast, now.date, now),
    tomorrow: hasDay(forecast, tomorrowDate) ? buildDay(forecast, tomorrowDate, now) : null,
    outlook,
  };
}
