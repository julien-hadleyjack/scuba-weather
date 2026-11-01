import { describe, expect, it, vi } from 'vitest';
import { AppState, type Deps } from './app-state.svelte';
import {
  fetchForecast,
  forecastUrl,
  isOnWater,
  marineUrl,
  parseForecast,
  searchPlaces,
} from './api';
import { pickBanner, shouldAutoRefresh, type StatusInput } from './status';
import { forecast } from '../test/helpers';
import type { Forecast, Spot } from './types';

const HOUR = 3_600_000;
const spot: Spot = {
  name: 'Chalok Bay',
  region: 'Surat Thani, Thailand',
  latitude: 10,
  longitude: 99.8,
};

describe('shouldAutoRefresh', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  it('refreshes when older than 1 hour and online', () => {
    expect(shouldAutoRefresh(now - HOUR - 1, now, true)).toBe(true);
    expect(shouldAutoRefresh(now - HOUR, now, true)).toBe(false);
    expect(shouldAutoRefresh(null, now, true)).toBe(true);
  });
  it('never when offline', () => {
    expect(shouldAutoRefresh(now - 5 * HOUR, now, false)).toBe(false);
  });
});

function setup(over: Partial<Deps> & { stored?: Forecast | null; clock?: { t: number } } = {}) {
  const clock = over.clock ?? { t: Date.UTC(2026, 10, 1, 3) };
  const saved: Forecast[] = [];
  const deps: Partial<Deps> = {
    loadSpot: () => spot,
    saveSpot: vi.fn(),
    loadForecast: () => (over.stored === undefined ? null : over.stored),
    saveForecast: (f) => saved.push(f),
    now: () => clock.t,
    online: () => true,
    fetchForecast: vi.fn(async () => ({ ...forecast(), fetchedAt: clock.t })),
    ...over,
  };
  return { state: new AppState(deps), deps, saved, clock };
}

describe('AppState refresh', () => {
  it('auto-refreshes stale data on open and stores the result', async () => {
    const stored = {
      ...forecast(),
      latitude: 10,
      longitude: 99.8,
      fetchedAt: Date.UTC(2026, 10, 1, 1),
    };
    const { state, deps, saved } = setup({ stored });
    await state.autoRefresh();
    expect(deps.fetchForecast).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
    expect(state.forecast!.fetchedAt).toBe(Date.UTC(2026, 10, 1, 3));
    expect(state.failed).toBe(false);
  });

  it('does not refresh fresh data automatically', async () => {
    const stored = { ...forecast(), fetchedAt: Date.UTC(2026, 10, 1, 2, 30) };
    const { state, deps } = setup({ stored });
    await state.autoRefresh();
    expect(deps.fetchForecast).not.toHaveBeenCalled();
  });

  it('does not fetch while offline and keeps the cached forecast', async () => {
    const stored = { ...forecast(), fetchedAt: Date.UTC(2026, 10, 1, 0) };
    const { state, deps } = setup({ stored, online: () => false });
    await state.autoRefresh();
    await state.refresh();
    expect(deps.fetchForecast).not.toHaveBeenCalled();
    expect(state.online).toBe(false);
    expect(state.forecast).toBe(stored);
  });

  it('a failed request keeps the old forecast and flags the failure', async () => {
    const stored = { ...forecast(), fetchedAt: Date.UTC(2026, 10, 1, 0) };
    const { state, saved } = setup({
      stored,
      fetchForecast: async () => Promise.reject(new Error('HTTP 500')),
    });
    await state.refresh();
    expect(state.failed).toBe(true);
    expect(state.refreshing).toBe(false);
    expect(state.forecast).toBe(stored);
    expect(saved).toHaveLength(0);
  });

  it('a later success clears the failure', async () => {
    let fail = true;
    const { state } = setup({
      fetchForecast: async () => (fail ? Promise.reject(new Error('x')) : forecast()),
    });
    await state.refresh();
    expect(state.failed).toBe(true);
    fail = false;
    await state.refresh();
    expect(state.failed).toBe(false);
  });

  it('ignores a cached forecast for a different spot', () => {
    const { state } = setup({ stored: { ...forecast(), latitude: 1, longitude: 2 } });
    expect(state.forecast).toBeNull();
  });

  it('coming back online triggers the auto-refresh', async () => {
    let online = false;
    const stored = { ...forecast(), fetchedAt: Date.UTC(2026, 10, 1, 0) };
    const { state, deps } = setup({ stored, online: () => online });
    expect(state.online).toBe(false);
    online = true;
    state.setOnline(true);
    await vi.waitFor(() => expect(deps.fetchForecast).toHaveBeenCalledTimes(1));
    expect(state.online).toBe(true);
  });

  it("a refresh for the previous spot does not end the new spot's loading (SPOT-8)", async () => {
    const pending: ((f: Forecast) => void)[] = [];
    const fetchForecast = vi.fn(() => new Promise<Forecast>((r) => pending.push(r)));
    const { state, saved } = setup({ fetchForecast });
    void state.refresh(); // spot A
    const other: Spot = { name: 'Sail Rock', region: '', latitude: 9.9, longitude: 100 };
    const choosing = state.chooseSpot(other);
    expect(fetchForecast).toHaveBeenCalledTimes(2);

    pending[0]({ ...forecast(), latitude: 10, longitude: 99.8 }); // A finishes late
    await Promise.resolve();
    await Promise.resolve();
    expect(state.refreshing).toBe(true);
    expect(state.forecast).toBeNull();
    expect(saved).toHaveLength(0);
    await state.refresh(); // still busy: no third request
    expect(fetchForecast).toHaveBeenCalledTimes(2);

    const b = { ...forecast(), latitude: 9.9, longitude: 100 };
    pending[1](b);
    await choosing;
    expect(state.refreshing).toBe(false);
    expect(state.forecast).toBe(b);
    expect(saved).toEqual([b]);
  });

  it('a late failure for the previous spot is ignored too', async () => {
    const pending: ((e: Error) => void)[] = [];
    const fetchForecast = vi.fn(() => new Promise<Forecast>((_, rej) => pending.push(rej)));
    const { state } = setup({ fetchForecast });
    const first = state.refresh();
    void state.chooseSpot({ name: 'Sail Rock', region: '', latitude: 9.9, longitude: 100 });
    pending[0](new Error('HTTP 500'));
    await first;
    expect(state.failed).toBe(false);
    expect(state.refreshing).toBe(true);
  });

  it('going offline clears a failed refresh (OFF-4)', async () => {
    let online = true;
    const stored = {
      ...forecast(),
      latitude: 10,
      longitude: 99.8,
      fetchedAt: Date.UTC(2026, 10, 1, 2, 30),
    };
    const { state, deps } = setup({
      stored,
      online: () => online,
      fetchForecast: vi.fn(async () => Promise.reject(new Error('HTTP 500'))),
    });
    await state.refresh();
    expect(state.failed).toBe(true);
    online = false;
    state.setOnline(false);
    expect(state.failed).toBe(false);
    online = true;
    state.setOnline(true);
    await Promise.resolve();
    // fresh data: no new attempt, so no failed banner
    expect(deps.fetchForecast).toHaveBeenCalledTimes(1);
    expect(state.failed).toBe(false);
  });

  it('a failure that happens because the device went offline shows as offline only', async () => {
    let online = true;
    const { state } = setup({
      online: () => online,
      fetchForecast: async () => {
        online = false;
        throw new Error('network');
      },
    });
    await state.refresh();
    expect(state.online).toBe(false);
    expect(state.failed).toBe(false);
  });
});

describe('banners', () => {
  const base: StatusInput = {
    nowMs: Date.UTC(2026, 10, 1, 5), // 12:00 at the spot
    fetchedAt: Date.UTC(2026, 10, 1, 2), // 3 h earlier
    online: true,
    failed: false,
    coversToday: true,
  };

  it('no banner when all is well', () => {
    expect(pickBanner(base)).toBeNull();
  });
  it('offline (OFF-3)', () => {
    expect(pickBanner({ ...base, online: false })).toEqual({
      kind: 'offline',
      tone: 'grey',
      text: 'Offline · forecast from 3 h ago',
    });
  });
  it('failed refresh (OFF-4)', () => {
    expect(pickBanner({ ...base, failed: true })!.text).toBe(
      "Couldn't update. Showing the forecast from 3 h ago. Tap refresh to try again.",
    );
  });
  it('older than 12 h: no forecast, with the next action (OFF-5)', () => {
    const at = (h: number) => ({ ...base, fetchedAt: base.nowMs - h * HOUR });
    expect(pickBanner(at(12))).toBeNull(); // exactly 12 h is still shown
    expect(pickBanner(at(14))).toEqual({
      kind: 'stale',
      tone: 'amber',
      title: 'No current forecast',
      text: 'The stored forecast is 14 h old. Tap refresh to load a new one.',
    });
    expect(pickBanner({ ...at(14), failed: true })!.text).toBe(
      "The stored forecast is 14 h old. Couldn't update. Tap refresh to try again.",
    );
    expect(pickBanner({ ...at(14), online: false })!.text).toBe(
      'The stored forecast is 14 h old. Connect to the internet to load a new one.',
    );
    expect(pickBanner(at(72))!.text).toBe(
      'The stored forecast is 3 d old. Tap refresh to load a new one.',
    );
  });
  it('a forecast that does not cover today is stale too', () => {
    expect(pickBanner({ ...base, coversToday: false, online: false, failed: true })!.kind).toBe(
      'stale',
    );
  });
});

describe('api', () => {
  it('builds the documented request parameters', () => {
    const f = new URL(forecastUrl(10.06, 99.82));
    expect(f.searchParams.get('hourly')).toBe(
      'precipitation,weather_code,cape,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    );
    expect(f.searchParams.get('daily')).toBe('sunrise,sunset');
    expect(f.searchParams.get('timezone')).toBe('auto');
    expect(f.searchParams.get('wind_speed_unit')).toBe('kmh');
    expect(f.searchParams.get('forecast_days')).toBe('6');
    expect(new URL(marineUrl(1, 1)).searchParams.get('forecast_days')).toBe('6');
    const m = new URL(marineUrl(10.06, 99.82));
    expect(m.searchParams.get('hourly')).toBe(
      'wave_height,wave_period,sea_level_height_msl,sea_surface_temperature',
    );
  });

  it('merges forecast and marine hours by local time', () => {
    const fc = {
      timezone: 'Asia/Bangkok',
      utc_offset_seconds: 25200,
      hourly: {
        time: ['2026-11-01T06:00', '2026-11-01T07:00'],
        precipitation: [0, 1.2],
        weather_code: [1, 95],
        cape: [100, 1500],
        wind_speed_10m: [10, 12],
        wind_gusts_10m: [20, 25],
        wind_direction_10m: [180, 190],
      },
      daily: { time: ['2026-11-01'], sunrise: ['2026-11-01T06:10'], sunset: ['2026-11-01T17:55'] },
    };
    const marine = {
      hourly: {
        time: ['2026-11-01T07:00'],
        wave_height: [0.8],
        wave_period: [5],
        sea_level_height_msl: [0.4],
        sea_surface_temperature: [29.2],
      },
    };
    const f = parseForecast(spot, fc, marine, 123);
    expect(f.hours[0]).toMatchObject({ hour: 6, code: 95, waveH: null, sst: null });
    expect(f.hours[1]).toMatchObject({ hour: 7, waveH: 0.8, waveT: 5, seaLevel: 0.4, sst: 29.2 });
    expect(f.days[0].sunset).toBe('2026-11-01T17:55');
    expect(f.fetchedAt).toBe(123);
  });

  it('precipitation, gusts and weather code cover the preceding hour, so each hour reads them from the next timestamp (DATA-9)', () => {
    const fc = {
      timezone: 'Asia/Bangkok',
      utc_offset_seconds: 25200,
      hourly: {
        time: ['2026-11-01T05:00', '2026-11-01T06:00', '2026-11-01T07:00'],
        precipitation: [9, 0, 1.2],
        weather_code: [80, 1, 95],
        cape: [50, 100, 1500],
        wind_speed_10m: [5, 10, 12],
        wind_gusts_10m: [60, 20, 25],
        wind_direction_10m: [170, 180, 190],
      },
      daily: { time: ['2026-11-01'], sunrise: ['2026-11-01T06:10'], sunset: ['2026-11-01T17:55'] },
    };
    const marine = {
      hourly: {
        time: [],
        wave_height: [],
        wave_period: [],
        sea_level_height_msl: [],
        sea_surface_temperature: [],
      },
    };
    const [h5, h6, h7] = parseForecast(spot, fc, marine, 0).hours;
    // 06:00–06:59 rain/gusts/code are reported at 07:00; instant values stay at their own hour.
    expect(h6).toMatchObject({
      hour: 6,
      precip: 1.2,
      gust: 25,
      code: 95,
      cape: 100,
      wind: 10,
      dir: 180,
    });
    expect(h5).toMatchObject({ hour: 5, precip: 0, gust: 20, code: 1 });
    // The last hour has no following timestamp: no data (DATA-8).
    expect(h7).toMatchObject({ hour: 7, precip: null, gust: null, code: null, cape: 1500 });
  });

  it('23:00–23:59 takes its rain, gusts and code from the next day at 00:00 (DATA-9)', () => {
    const fc = {
      timezone: 'Asia/Bangkok',
      utc_offset_seconds: 25200,
      hourly: {
        time: ['2026-11-01T23:00', '2026-11-02T00:00', '2026-11-02T01:00'],
        precipitation: [0, 6.5, 0],
        weather_code: [3, 95, 3],
        cape: [800, 900, 700],
        wind_speed_10m: [10, 10, 10],
        wind_gusts_10m: [15, 48, 15],
        wind_direction_10m: [90, 90, 90],
      },
      daily: { time: ['2026-11-01', '2026-11-02'], sunrise: [null, null], sunset: [null, null] },
    };
    const marine = {
      hourly: {
        time: [],
        wave_height: [],
        wave_period: [],
        sea_level_height_msl: [],
        sea_surface_temperature: [],
      },
    };
    const [h23, h0] = parseForecast(spot, fc, marine, 0).hours;
    expect(h23).toMatchObject({
      date: '2026-11-01',
      hour: 23,
      precip: 6.5,
      gust: 48,
      code: 95,
      cape: 800,
    });
    expect(h0).toMatchObject({ date: '2026-11-02', hour: 0, precip: 0, gust: 15, code: 3 });
  });

  it('search maps results to name and region', async () => {
    const fake = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: 1,
                name: 'Koh Tao',
                latitude: 10.1,
                longitude: 99.84,
                admin1: 'Surat Thani',
                country: 'Thailand',
              },
            ],
          }),
        ),
    );
    const res = await searchPlaces('koh tao', undefined, fake as unknown as typeof fetch);
    expect(res).toEqual([
      { id: 1, name: 'Koh Tao', region: 'Surat Thani, Thailand', latitude: 10.1, longitude: 99.84 },
    ]);
    expect(
      await searchPlaces('zzz', undefined, (async () => new Response('{}')) as typeof fetch),
    ).toEqual([]);
  });

  it('null sea values mean the pin is on land', async () => {
    const land = async () => new Response(JSON.stringify({ current: { wave_height: null } }));
    const water = async () => new Response(JSON.stringify({ current: { wave_height: 0.4 } }));
    expect(await isOnWater(13.75, 100.5, undefined, land as typeof fetch)).toBe(false);
    expect(await isOnWater(10, 99.8, undefined, water as typeof fetch)).toBe(true);
  });

  it('fetchForecast runs both requests and fails unless both succeed (DATA-3)', async () => {
    const fcBody = {
      timezone: 'Asia/Bangkok',
      utc_offset_seconds: 25200,
      hourly: {
        time: ['2026-11-01T06:00'],
        precipitation: [0.2],
        weather_code: [51],
        cape: [10],
        wind_speed_10m: [8],
        wind_gusts_10m: [14],
        wind_direction_10m: [90],
      },
      daily: { time: ['2026-11-01'], sunrise: ['2026-11-01T06:10'], sunset: ['2026-11-01T17:55'] },
    };
    const marineBody = {
      hourly: {
        time: ['2026-11-01T06:00'],
        wave_height: [0.5],
        wave_period: [7],
        sea_level_height_msl: [0.1],
        sea_surface_temperature: [29],
      },
    };
    const urls: string[] = [];
    const ok = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(url.includes('marine') ? marineBody : fcBody));
    }) as unknown as typeof fetch;
    const f = await fetchForecast(spot, ok, () => 42);
    expect(urls).toHaveLength(2);
    expect(f).toMatchObject({ timezone: 'Asia/Bangkok', fetchedAt: 42, latitude: 10 });
    expect(f.hours[0]).toMatchObject({ cape: 10, waveH: 0.5, sst: 29 });

    const marineDown = (async (url: string) =>
      url.includes('marine')
        ? new Response('', { status: 503 })
        : new Response(JSON.stringify(fcBody))) as unknown as typeof fetch;
    await expect(fetchForecast(spot, marineDown)).rejects.toThrow('HTTP 503');
  });

  it('fetchForecast fails after the timeout and cancels both requests (DATA-3)', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const hang = ((_url: string, init?: RequestInit) => {
        signals.push(init!.signal!);
        return new Promise(() => {}); // never answers, even when aborted
      }) as unknown as typeof fetch;
      const p = fetchForecast(spot, hang);
      const result = expect(p).rejects.toThrow('Request timed out');
      await vi.advanceTimersByTimeAsync(19_999);
      expect(signals.every((s) => !s.aborted)).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      await result;
      expect(signals).toHaveLength(2);
      expect(signals.every((s) => s.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetchForecast cancels the other request when one fails', async () => {
    let marineSignal: AbortSignal | undefined;
    const f = ((url: string, init?: RequestInit) => {
      if (url.includes('marine')) {
        marineSignal = init!.signal!;
        return new Promise(() => {});
      }
      return Promise.resolve(new Response('', { status: 429 }));
    }) as unknown as typeof fetch;
    await expect(fetchForecast(spot, f)).rejects.toThrow('HTTP 429');
    expect(marineSignal!.aborted).toBe(true);
  });

  it('API error bodies are failures', async () => {
    const err = async () => new Response(JSON.stringify({ error: true, reason: 'limit' }));
    await expect(isOnWater(1, 1, undefined, err as typeof fetch)).rejects.toThrow('limit');
  });
});
