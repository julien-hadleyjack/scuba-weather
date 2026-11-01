import { afterEach, describe, expect, it } from 'vitest';
import { buildDashboard, buildDay, isPast } from './dashboard';
import { addDays, ago, dayLabel, fractionalHour, localTime } from './time';
import { forecast } from '../test/helpers';

describe('time helpers', () => {
  it('local time at the spot uses the spot time zone', () => {
    // 2026-10-31 23:30 UTC = 2026-11-01 06:30 in Bangkok
    const t = localTime(Date.UTC(2026, 9, 31, 23, 30), 'Asia/Bangkok', 7 * 3600);
    expect(t).toEqual({ date: '2026-11-01', hour: 6, minute: 30 });
  });

  it('falls back to the fixed offset for an unknown zone', () => {
    const t = localTime(Date.UTC(2026, 9, 31, 23, 30), 'Not/AZone', 7 * 3600);
    expect(t).toEqual({ date: '2026-11-01', hour: 6, minute: 30 });
  });

  it('dates and labels', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayLabel('2026-11-01')).toEqual({ weekday: 'Sun', date: '1 Nov' });
    expect(fractionalHour('2026-11-01T17:45', '2026-11-01')).toBe(17.75);
  });

  it('ago', () => {
    const now = Date.UTC(2026, 10, 1, 12);
    expect(ago(now - 20_000, now)).toBe('just now');
    expect(ago(now - 25 * 60_000, now)).toBe('25 min ago');
    expect(ago(now - 2.5 * 3600_000, now)).toBe('2 h ago');
    expect(ago(now - 72 * 3600_000, now)).toBe('3 d ago');
  });
});

describe('past blocks', () => {
  const now = { date: '2026-11-01', hour: 12, minute: 0 };
  it('a block is over once its last hour has ended', () => {
    expect(isPast('2026-11-01', 12, now)).toBe(true);
    expect(isPast('2026-11-01', 12, { ...now, hour: 11, minute: 59 })).toBe(false);
    expect(isPast('2026-11-01', 18, now)).toBe(false);
    expect(isPast('2026-11-02', 12, now)).toBe(false);
    expect(isPast('2026-10-31', 22, now)).toBe(true);
  });
});

describe('TEST-2: spot in UTC+7 viewed from a device in UTC+1', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it('uses the spot calendar day and hour, not the device ones', () => {
    process.env.TZ = 'Europe/Berlin'; // device: UTC+1 in November
    const f = forecast('2026-11-01', 5, (h) => ({
      // mark the spot's 13:00 hour with rain so we can find it
      precip: h.date === '2026-11-02' && h.hour === 13 ? 9 : 0,
    }));
    // Device time: Sun 1 Nov 23:30 in Berlin = 22:30 UTC = Mon 2 Nov 05:30 at the spot.
    const now = Date.UTC(2026, 10, 1, 22, 30);
    const view = buildDashboard(f, now)!;
    expect(view.now).toEqual({ date: '2026-11-02', hour: 5, minute: 30 });
    expect(view.today.date).toBe('2026-11-02');
    expect(view.tomorrow!.date).toBe('2026-11-03');
    // 05:30 at the spot: no block is over yet.
    expect(view.today.blocks.map((b) => b.past)).toEqual([false, false, false]);
    // The 13:00 spot-time rain lands in the Afternoon block of "today".
    expect(view.today.blocks[1].cells.rain.label).toBe('Bursts');
    expect(view.today.blocks[0].cells.rain.label).toBe('Dry');
    expect(view.outlook.map((r) => r.date)).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('dims the right blocks later in the spot day', () => {
    const f = forecast('2026-11-01');
    // 11:00 UTC = 18:00 at the spot (12:00 in Berlin)
    const view = buildDashboard(f, Date.UTC(2026, 10, 1, 11, 0))!;
    expect(view.today.blocks.map((b) => b.past)).toEqual([true, true, false]);
    expect(view.tomorrow!.blocks.every((b) => !b.past)).toBe(true);
  });

  it('the Night block covers 18–24', () => {
    const f = forecast('2026-11-01', 5, (h) => ({ precip: h.hour === 23 ? 9 : 0 }));
    const view = buildDashboard(f, Date.UTC(2026, 10, 1, 0))!; // 07:00 at the spot
    expect(view.today.blocks[2]).toMatchObject({ start: 18, end: 24, past: false });
    expect(view.today.blocks[2].cells.rain.label).toBe('Bursts');
    expect(view.outlook[0].cells.rain.label).toBe('Bursts');
  });

  it('a cached forecast moves forward to the new day (DATA-5)', () => {
    const f = forecast('2026-11-01');
    const view = buildDashboard(f, Date.UTC(2026, 10, 3, 3, 0))!; // 3 Nov 10:00 at spot
    expect(view.today.date).toBe('2026-11-03');
    expect(view.outlook.map((r) => r.date)).toEqual(['2026-11-05']);
  });

  it('returns null when the forecast no longer covers today (OFF-5)', () => {
    const f = forecast('2026-11-01');
    expect(buildDashboard(f, Date.UTC(2026, 10, 6, 3, 0))).toBeNull();
  });
});

describe('day view', () => {
  const now = { date: '2026-11-01', hour: 7, minute: 0 };

  it('chart covers 06–24 with night shading from sunrise/sunset', () => {
    const day = buildDay(forecast(), '2026-11-01', now);
    expect(day.chart.hours.map((h) => h.hour)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
    expect(day.chart.tide).toHaveLength(19);
    expect(day.chart.night[0][0]).toBe(6);
    expect(day.chart.night[0][1]).toBeCloseTo(6 + 10 / 60);
    expect(day.chart.night[1][0]).toBeCloseTo(17 + 55 / 60);
    expect(day.chart.night[1][1]).toBe(24);
  });

  it('the tide line ends with the next day 00:00, missing on the last day', () => {
    const f = forecast('2026-11-01', 2, (h) => ({ seaLevel: h.date === '2026-11-02' && h.hour === 0 ? 5 : 0 }));
    expect(buildDay(f, '2026-11-01', now).chart.tide.at(-1)).toBe(1);
    expect(buildDay(f, '2026-11-02', now).chart.tide.at(-1)).toBeNull();
  });

  it('tide is scaled between the day low and high', () => {
    const day = buildDay(forecast(), '2026-11-01', now);
    const vals = day.chart.tide.filter((v): v is number => v !== null);
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1);
  });

  it('water temperature is the rounded 06–24 average', () => {
    const f = forecast('2026-11-01', 1, (h) => ({ sst: h.hour >= 6 ? (h.hour < 15 ? 28.4 : 29.0) : 10 }));
    expect(buildDay(f, '2026-11-01', now).water).toBe(29);
    const none = forecast('2026-11-01', 1, () => ({ sst: null }));
    expect(buildDay(none, '2026-11-01', now).water).toBeNull();
  });
});
