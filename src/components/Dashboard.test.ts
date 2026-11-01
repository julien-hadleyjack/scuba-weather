import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Dashboard from './Dashboard.svelte';
import { AppState, type Deps } from '../lib/app-state.svelte';
import { forecast } from '../test/helpers';
import type { Forecast, Spot } from '../lib/types';

const spot: Spot = {
  name: 'Chalok Bay',
  region: 'Surat Thani, Thailand',
  latitude: 10,
  longitude: 99.8,
};
// 2026-11-01 12:00 at the spot (UTC+7)
const NOW = Date.UTC(2026, 10, 1, 5);
const HOUR = 3_600_000;

function app(stored: Forecast | null, over: Partial<Deps> = {}) {
  return new AppState({
    loadSpot: () => spot,
    saveSpot: () => {},
    loadForecast: () => stored,
    saveForecast: () => {},
    now: () => NOW,
    online: () => true,
    fetchForecast: vi.fn(async () => ({ ...forecast(), fetchedAt: NOW })),
    ...over,
  });
}

function show(a: AppState) {
  const onChangeSpot = vi.fn();
  render(Dashboard, { app: a, onChangeSpot });
  return { onChangeSpot };
}

describe('Dashboard', () => {
  it('header, data age, sections and footer (DASH-1…DASH-13)', () => {
    show(app({ ...forecast(), fetchedAt: NOW - 2 * HOUR }));
    expect(screen.getByRole('heading', { level: 1, name: 'Chalok Bay' })).toBeInTheDocument();
    expect(screen.getByText('Surat Thani, Thailand')).toBeInTheDocument();
    expect(screen.getByText('Updated 2 h ago')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next days' })).toBeInTheDocument();
    expect(screen.getByText(/Not a safety tool/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('change spot button', async () => {
    const { onChangeSpot } = show(app(forecast()));
    await fireEvent.click(screen.getByRole('button', { name: 'Change dive spot' }));
    expect(onChangeSpot).toHaveBeenCalled();
  });

  it('refresh button spins and is disabled while refreshing (DASH-3)', async () => {
    let resolve!: (f: Forecast) => void;
    const a = app(forecast(), { fetchForecast: () => new Promise((r) => (resolve = r)) });
    show(a);
    const btn = screen.getByRole('button', { name: 'Refresh forecast' });
    await fireEvent.click(btn);
    const busy = screen.getByRole('button', { name: 'Refreshing forecast' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveClass('spinning');
    resolve({ ...forecast(), fetchedAt: NOW });
    await screen.findByRole('button', { name: 'Refresh forecast' });
    expect(screen.getByText('Updated just now')).toBeInTheDocument();
  });

  it('failed refresh shows the amber banner (OFF-4)', async () => {
    const a = app(
      { ...forecast(), fetchedAt: NOW - 3 * HOUR },
      { fetchForecast: () => Promise.reject(new Error('x')) },
    );
    show(a);
    await a.refresh();
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Couldn't update. Showing the forecast from 3 h ago. Tap refresh to try again.",
    );
  });

  it('offline: grey banner and refresh disabled (OFF-3)', () => {
    show(app({ ...forecast(), fetchedAt: NOW - HOUR }, { online: () => false }));
    expect(screen.getByRole('status')).toHaveTextContent('Offline · forecast from 1 h ago');
    expect(screen.getByRole('button', { name: 'Refresh forecast' })).toBeDisabled();
  });

  it('forecast older than 12 h: message instead of data (OFF-5)', () => {
    show(app({ ...forecast(), fetchedAt: NOW - 13 * HOUR }));
    expect(screen.getByText('No current forecast')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'The stored forecast is 13 h old. Tap refresh to load a new one.',
    );
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('stale and offline: one message, no offline banner', () => {
    show(app({ ...forecast(), fetchedAt: NOW - 13 * HOUR }, { online: () => false }));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Connect to the internet to load a new one.',
    );
  });

  it('exactly 12 h old is still shown', () => {
    show(app({ ...forecast(), fetchedAt: NOW - 12 * HOUR }));
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });

  it('a forecast that no longer covers today shows the message too', () => {
    // Clock moved back: fresh fetch time, but dates before today.
    show(app({ ...forecast('2026-10-20'), fetchedAt: NOW - HOUR }));
    expect(screen.getByText('No current forecast')).toBeInTheDocument();
  });

  it('only today in the forecast: no Tomorrow, no Next days', () => {
    show(app(forecast('2026-11-01', 1)));
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tomorrow' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Next days' })).toBeNull();
  });

  describe('no forecast stored yet', () => {
    it('loading', async () => {
      const a = app(null, { fetchForecast: () => new Promise(() => {}) });
      show(a);
      void a.refresh();
      expect(await screen.findByText('Loading forecast…')).toBeInTheDocument();
    });
    it('offline', () => {
      show(app(null, { online: () => false }));
      expect(screen.getByText(/No forecast stored for this spot yet/)).toBeInTheDocument();
    });
    it('failed', async () => {
      const a = app(null, { fetchForecast: () => Promise.reject(new Error('x')) });
      show(a);
      await a.refresh();
      expect(await screen.findByText("Couldn't load the forecast.")).toBeInTheDocument();
    });
    it('idle', () => {
      show(app(null));
      expect(screen.getByText('No forecast yet. Tap refresh to load one.')).toBeInTheDocument();
    });
  });
});
