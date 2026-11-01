import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { forecast } from './test/helpers';
import type { Spot } from './lib/types';

vi.mock('leaflet', () => import('./test/leaflet-mock'));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const api = vi.hoisted(() => ({
  fetchForecast: vi.fn(),
  searchPlaces: vi.fn(async () => []),
  isOnWater: vi.fn(async () => true),
}));
vi.mock('./lib/api', () => api);

import App from './App.svelte';
import { maps } from './test/leaflet-mock';

const spot: Spot = { name: 'Chalok Bay', region: 'Surat Thani, Thailand', latitude: 10, longitude: 99.8 };

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    api.fetchForecast.mockReset().mockImplementation(async () => ({ ...forecast(), fetchedAt: Date.now() }));
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(Date.UTC(2026, 10, 1, 5));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('first launch opens the spot screen, with no back button (SPOT-1)', async () => {
    render(App);
    expect(await screen.findByRole('heading', { name: 'Choose dive spot' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to dashboard' })).toBeNull();
    expect(api.fetchForecast).not.toHaveBeenCalled();
  });

  it('with a stored spot, opens the dashboard and refreshes old data (DATA-6)', async () => {
    localStorage.setItem('scuba-weather.spot.v1', JSON.stringify(spot));
    render(App);
    expect(screen.getByRole('heading', { level: 1, name: 'Chalok Bay' })).toBeInTheDocument();
    await waitFor(() => expect(api.fetchForecast).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('scuba-weather.forecast.v1')!).hours.length).toBeGreaterThan(0);
  });

  it('change spot → back → dashboard; choosing a spot saves it and loads its forecast', async () => {
    localStorage.setItem('scuba-weather.spot.v1', JSON.stringify(spot));
    render(App);
    await screen.findByRole('heading', { name: 'Today' });

    await fireEvent.click(screen.getByRole('button', { name: 'Change dive spot' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Back to dashboard' }));
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Change dive spot' }));
    await screen.findByRole('button', { name: /Use this spot/ });
    maps[maps.length - 1].panTo(7.6, 98.4);
    await screen.findByText('7.60° N, 98.40° E');
    await fireEvent.click(screen.getByRole('button', { name: /Use this spot/ }));
    await waitFor(() => expect(api.isOnWater).toHaveBeenLastCalledWith(7.6, 98.4, expect.anything()));

    await screen.findByRole('heading', { name: 'Today' });
    expect(JSON.parse(localStorage.getItem('scuba-weather.spot.v1')!)).toMatchObject({ latitude: 7.6, longitude: 98.4 });
    expect(api.fetchForecast).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 7.6 }));
  });

  it('reacts to going offline/online and to returning to the foreground', async () => {
    localStorage.setItem('scuba-weather.spot.v1', JSON.stringify(spot));
    const { unmount } = render(App);
    await screen.findByRole('heading', { name: 'Today' });

    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByRole('status')).toHaveTextContent('Offline · forecast from just now');

    // Two hours later the app comes back online and refreshes.
    online.mockReturnValue(true);
    vi.setSystemTime(Date.UTC(2026, 10, 1, 7));
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(api.fetchForecast).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh forecast' })).toBeEnabled());

    // Back in the foreground after another two hours.
    vi.setSystemTime(Date.UTC(2026, 10, 1, 9));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(api.fetchForecast).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh forecast' })).toBeEnabled());

    // The minute tick keeps the data age current.
    vi.setSystemTime(Date.UTC(2026, 10, 1, 9, 29)); // the tick below adds a minute
    vi.advanceTimersByTime(60_000);
    expect(await screen.findByText('Updated 30 min ago')).toBeInTheDocument();
    unmount();
  });
});
