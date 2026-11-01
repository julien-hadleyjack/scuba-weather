// All classification constants in one place (requirements §4).

/** Hour with at least this much precipitation (mm) counts as a "rainy hour". */
export const RAINY_HOUR_MM = 0.5;
/** Hour with at least this much (but less than RAINY_HOUR_MM) is a "drizzle hour". */
export const DRIZZLE_HOUR_MM = 0.1;
/** Share of rainy hours from which rain counts as "Persistent". */
export const PERSISTENT_SHARE = 0.5;
/** Peak rate (mm/h) from which showers become marginal. */
export const RAIN_PEAK_MARGINAL = 2.5;
/** Peak rate (mm/h) from which rain counts as "Bursts" (poor). */
export const RAIN_PEAK_POOR = 7.6;

/** CAPE (J/kg) that turns a rainy hour into "Possible" thunderstorm. Tunable. */
export const STORM_CAPE = 1000;
/** WMO weather codes for thunderstorms. */
export const THUNDER_CODES: readonly number[] = [95, 96, 99];

export const WIND_MARGINAL = 20;
export const WIND_POOR = 29;
export const GUST_MARGINAL = 35;
export const GUST_POOR = 45;

export const WAVE_MARGINAL = 1.0;
export const WAVE_POOR = 2.0;
/** Steep rule applies when period (s) < STEEP_FACTOR × height (m). */
export const STEEP_FACTOR = 6.5;
export const STEEP_MARGINAL = 0.6;
export const STEEP_POOR = 1.25;

/** Rain bar intensity bands for the chart (mm/h). */
export const RAIN_MODERATE = 2.5;
export const RAIN_HEAVY = 7.6;

/** Dive blocks, local hours [start, end). */
export const BLOCKS = [
  { id: 'morning', name: 'Morning', start: 6, end: 12 },
  { id: 'afternoon', name: 'Afternoon', start: 12, end: 18 },
  { id: 'night', name: 'Night', start: 18, end: 24 },
] as const;
export const DAY_START = 6;
export const DAY_END = 24;

/** Auto-refresh when data is older than this. */
export const REFRESH_AFTER_MS = 60 * 60 * 1000;
/** Warn when data is older than this. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
