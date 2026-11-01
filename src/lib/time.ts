// Time helpers. Every date/time shown is in the dive spot's time zone
// (DATA-4), independent of the phone's time zone.

export interface LocalTime {
  /** "YYYY-MM-DD" */
  date: string;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat | null {
  if (formatters.has(timeZone)) return formatters.get(timeZone)!;
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
    return f;
  } catch {
    return null;
  }
}

/**
 * Wall-clock time at the spot for an instant. Uses the IANA zone when the
 * browser knows it, otherwise the fixed UTC offset from the forecast.
 */
export function localTime(epochMs: number, timeZone: string, utcOffsetSeconds: number): LocalTime {
  const f = formatter(timeZone);
  if (f) {
    const parts = Object.fromEntries(f.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour) % 24,
      minute: Number(parts.minute),
    };
  }
  const d = new Date(epochMs + utcOffsetSeconds * 1000);
  return {
    date: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Add days to a "YYYY-MM-DD" calendar date. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-01" → { weekday: "Sun", date: "1 Nov" } */
export function dayLabel(date: string): { weekday: string; date: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return { weekday: WEEKDAYS[d.getUTCDay()], date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
}

/** "N min ago" / "N h ago" / "N d ago". */
export function ago(fromMs: number, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - fromMs) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Fractional hour of a local "YYYY-MM-DDTHH:MM" string, relative to `date`. */
export function fractionalHour(local: string, date: string): number {
  const day = local.slice(0, 10);
  const h = Number(local.slice(11, 13)) + Number(local.slice(14, 16)) / 60;
  if (day === date) return h;
  return day < date ? h - 24 : h + 24;
}
