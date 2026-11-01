// Refresh decisions and the status shown above the forecast (DATA-6, OFF-3…OFF-5). Pure.
import { REFRESH_AFTER_MS, STALE_AFTER_MS } from './thresholds';
import { ago } from './time';

export function shouldAutoRefresh(
  fetchedAt: number | null,
  nowMs: number,
  online: boolean,
): boolean {
  if (!online) return false;
  return fetchedAt === null || nowMs - fetchedAt > REFRESH_AFTER_MS;
}

/** Forecast too old to show (OFF-5): older than 12 h, or no longer covering today. */
export function isStale(fetchedAt: number, nowMs: number, coversToday = true): boolean {
  return !coversToday || nowMs - fetchedAt > STALE_AFTER_MS;
}

export type BannerKind = 'stale' | 'failed' | 'offline';

export interface Banner {
  kind: BannerKind;
  tone: 'grey' | 'amber';
  /** Only for 'stale': the message heading. */
  title?: string;
  text: string;
}

export interface StatusInput {
  nowMs: number;
  fetchedAt: number;
  online: boolean;
  /** Last refresh attempt failed (while online). */
  failed: boolean;
  /** The forecast covers the spot's current date. */
  coversToday: boolean;
}

/** "14 h", "3 d" */
export function ageText(fromMs: number, nowMs: number): string {
  const h = Math.floor((nowMs - fromMs) / 3_600_000);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

/**
 * At most one status, priority: stale (replaces the forecast) > failed > offline.
 */
export function pickBanner(s: StatusInput): Banner | null {
  if (isStale(s.fetchedAt, s.nowMs, s.coversToday)) {
    let action: string;
    if (!s.online) action = 'Connect to the internet to load a new one.';
    else if (s.failed) action = "Couldn't update. Tap refresh to try again.";
    else action = 'Tap refresh to load a new one.';
    return {
      kind: 'stale',
      tone: 'amber',
      title: 'No current forecast',
      text: `The stored forecast is ${ageText(s.fetchedAt, s.nowMs)} old. ${action}`,
    };
  }
  const age = ago(s.fetchedAt, s.nowMs);
  if (s.online && s.failed) {
    return {
      kind: 'failed',
      tone: 'amber',
      text: `Couldn't update. Showing the forecast from ${age}. Tap refresh to try again.`,
    };
  }
  if (!s.online) return { kind: 'offline', tone: 'grey', text: `Offline · forecast from ${age}` };
  return null;
}
