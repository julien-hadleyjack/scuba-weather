import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { maps } from '../test/leaflet-mock';
import type { Place, Spot } from '../lib/types';

vi.mock('leaflet', () => import('../test/leaflet-mock'));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const api = vi.hoisted(() => ({
  searchPlaces: vi.fn<(q: string, s?: AbortSignal) => Promise<Place[]>>(),
  isOnWater: vi.fn<(lat: number, lon: number, s?: AbortSignal) => Promise<boolean>>(),
}));
vi.mock('../lib/api', () => api);

import SpotPicker from './SpotPicker.svelte';

const places: Place[] = [
  { id: 1, name: 'Koh Tao', region: 'Surat Thani, Thailand', latitude: 10.1, longitude: 99.84 },
  { id: 2, name: 'Koh Tao Pier', region: '', latitude: 10.09, longitude: 99.82 },
];
const stored: Spot = {
  name: 'Chalok Bay',
  region: 'Surat Thani, Thailand',
  latitude: 10.06,
  longitude: 99.82,
};

function setup(props: Partial<{ initial: Spot | null; online: boolean; onBack: () => void }> = {}) {
  const onUse = vi.fn();
  const r = render(SpotPicker, { initial: null, online: true, onUse, ...props });
  const input = screen.getByRole('combobox');
  return {
    ...r,
    onUse,
    input,
    get map() {
      return maps[maps.length - 1];
    },
    get useBtn() {
      return screen.getByRole('button', { name: /Use this spot/ });
    },
  };
}

async function pickFirst(input: HTMLElement) {
  await type(input, 'koh');
  const [first] = await screen.findAllByRole('option');
  await fireEvent.click(first);
}

async function type(input: HTMLElement, value: string) {
  await fireEvent.input(input, { target: { value } });
}

describe('SpotPicker', () => {
  beforeEach(() => {
    maps.length = 0;
    api.searchPlaces.mockReset().mockResolvedValue(places);
    api.isOnWater.mockReset().mockResolvedValue(true);
  });

  it('first launch: placeholder instead of map, no back button, search focused (SPOT-1, SPOT-10)', () => {
    const { input } = setup();
    expect(screen.queryByRole('button', { name: 'Back to dashboard' })).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Search for a place, island or dive site above.')).toBeInTheDocument();
    expect(maps).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Use this spot/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });

  it('the map appears once a result is chosen', async () => {
    const { input } = setup();
    await pickFirst(input);
    expect(maps).toHaveLength(1);
    expect(maps[0].center).toEqual({ lat: 10.1, lng: 99.84 });
    expect(maps[0].zoom).toBe(12);
    expect(screen.queryByText('Search for a place, island or dive site above.')).toBeNull();
    // a second search moves the existing map
    await type(input, 'koh t');
    const options = await screen.findAllByRole('option');
    await fireEvent.click(options[1]);
    expect(maps).toHaveLength(1);
    expect(maps[0].center).toEqual({ lat: 10.09, lng: 99.82 });
  });

  it('searches from 2 characters, debounced (SPOT-2)', async () => {
    const { input } = setup();
    await type(input, 'k');
    await new Promise((r) => setTimeout(r, 350));
    expect(api.searchPlaces).not.toHaveBeenCalled();
    await type(input, 'ko');
    await type(input, 'koh');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(api.searchPlaces).toHaveBeenCalledTimes(1);
    expect(api.searchPlaces.mock.calls[0][0]).toBe('koh');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Surat Thani, Thailand')).toBeInTheDocument();
  });

  it('shows "no places" and search errors', async () => {
    const { input } = setup();
    api.searchPlaces.mockResolvedValueOnce([]);
    await type(input, 'zzz');
    await screen.findByText('No places found.');
    api.searchPlaces.mockRejectedValueOnce(new Error('offline'));
    await type(input, 'zzzz');
    await screen.findByText('Search failed. Check your connection.');
  });

  it('keyboard: arrows move, Enter chooses, Escape closes (combobox pattern)', async () => {
    const t = setup();
    const { input } = t;
    await type(input, 'koh');
    await screen.findAllByRole('option');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'place-2');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'place-1');
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', 'place-2');
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(t.map.center).toEqual({ lat: 10.1, lng: 99.84 });
    expect(t.map.zoom).toBe(12);
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await type(input, 'koh t');
    await screen.findAllByRole('option');
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.keyDown(input, { key: 'Escape' }); // closed list: no-op
    await fireEvent.focus(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('no check while moving; the check runs when saving, and water saves (SPOT-5…SPOT-8)', async () => {
    const t = setup();
    await pickFirst(t.input);
    expect(t.useBtn).toBeEnabled();
    expect(screen.getByText('10.10° N, 99.84° E')).toBeInTheDocument();

    // drag a little: same name, new coordinates, still no request
    t.map.panTo(10.05, 99.8);
    await screen.findByText('10.05° N, 99.80° E');
    expect(api.isOnWater).not.toHaveBeenCalled();

    let resolve!: (v: boolean) => void;
    api.isOnWater.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    await fireEvent.click(t.useBtn);
    const busy = screen.getByRole('button', { name: /Checking position/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(api.isOnWater).toHaveBeenCalledWith(10.05, 99.8, expect.anything());
    resolve(true);
    await waitFor(() =>
      expect(t.onUse).toHaveBeenCalledWith({
        name: 'Koh Tao',
        region: 'Surat Thani, Thailand',
        latitude: 10.05,
        longitude: 99.8,
      }),
    );
  });

  it('pin on land: not saved, button disabled until the map moves', async () => {
    const t = setup({ initial: stored });
    api.isOnWater.mockResolvedValueOnce(false);
    await fireEvent.click(t.useBtn);
    await screen.findByText('Pin is on land');
    expect(t.onUse).not.toHaveBeenCalled();
    expect(t.useBtn).toBeDisabled();
    expect(screen.getByText('Move the pin onto open water, then try again.')).toBeInTheDocument();
    await fireEvent.click(t.useBtn); // disabled: no second request
    expect(api.isOnWater).toHaveBeenCalledTimes(1);

    t.map.panTo(10.0, 99.9);
    await waitFor(() => expect(t.useBtn).toBeEnabled());
    expect(screen.queryByText('Pin is on land')).toBeNull();
  });

  it('failed check: says so and can be retried', async () => {
    const t = setup({ initial: stored });
    api.isOnWater.mockRejectedValueOnce(new Error('HTTP 500'));
    await fireEvent.click(t.useBtn);
    await screen.findByText('Check failed');
    expect(t.onUse).not.toHaveBeenCalled();
    expect(t.useBtn).toBeEnabled();
    await fireEvent.click(t.useBtn);
    await waitFor(() => expect(t.onUse).toHaveBeenCalled());
  });

  it('choosing a result cancels a pending search, so the list stays closed (SPOT-2)', async () => {
    const t = setup();
    await type(t.input, 'koh');
    const [first] = await screen.findAllByRole('option');
    await type(t.input, 'koh t'); // debounced search now pending
    await fireEvent.click(first);
    expect(t.input).toHaveAttribute('aria-expanded', 'false');
    await new Promise((r) => setTimeout(r, 350));
    expect(api.searchPlaces).toHaveBeenCalledTimes(1);
    expect(t.input).toHaveAttribute('aria-expanded', 'false');
  });

  it('a search answering after a result was chosen is ignored (SPOT-2)', async () => {
    const t = setup();
    await type(t.input, 'koh');
    const [first] = await screen.findAllByRole('option');
    let resolve!: (p: Place[]) => void;
    api.searchPlaces.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    await type(t.input, 'koh t');
    await waitFor(() => expect(api.searchPlaces).toHaveBeenCalledTimes(2));
    await fireEvent.click(first);
    resolve(places); // ignores the abort signal and answers anyway
    await new Promise((r) => setTimeout(r, 0));
    expect(t.input).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.focus(t.input); // no late results waiting to reopen the list
    expect(t.input).toHaveAttribute('aria-expanded', 'false');
  });

  it('choosing a result clears an earlier land result, even without a map move (SPOT-5)', async () => {
    const t = setup();
    await pickFirst(t.input);
    api.isOnWater.mockResolvedValueOnce(false);
    await fireEvent.click(t.useBtn);
    await screen.findByText('Pin is on land');
    expect(t.useBtn).toBeDisabled();
    // same place again: setView to the same position, the stand-in still fires
    // move events, so stop it from doing so to mimic a no-op setView
    t.map.move = () => {};
    await type(t.input, 'koh t');
    const [again] = await screen.findAllByRole('option');
    await fireEvent.click(again);
    expect(screen.queryByText('Pin is on land')).toBeNull();
    expect(t.useBtn).toBeEnabled();
  });

  it('moving the map cancels a running check', async () => {
    const t = setup({ initial: stored });
    api.isOnWater.mockImplementationOnce(
      (_a, _b, signal) =>
        new Promise((_, reject) =>
          signal!.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))),
        ),
    );
    await fireEvent.click(t.useBtn);
    t.map.panTo(-13.75, -100.5);
    await screen.findByText('13.75° S, 100.50° W');
    await waitFor(() => expect(t.useBtn).toHaveTextContent('Use this spot'));
    expect(screen.queryByText('Check failed')).toBeNull();
    expect(t.onUse).not.toHaveBeenCalled();
  });

  it('starts from the stored spot and has a working back button (SPOT-10)', async () => {
    const onBack = vi.fn();
    setup({ initial: stored, onBack });
    expect(screen.getByText('Chalok Bay')).toBeInTheDocument();
    expect(screen.getByText('10.06° N, 99.82° E')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('zoom buttons and clear search', async () => {
    const { map, input } = setup({ initial: stored });
    const z = map.zoom;
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(map.zoom).toBe(z + 1);
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(map.zoom).toBe(z);
    await type(input, 'a');
    await fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(document.activeElement).toBe(input);
  });

  it('tells the user when offline', async () => {
    setup({ online: false });
    expect(
      screen.getByText('You are offline. Choosing a dive spot needs a connection.'),
    ).toBeInTheDocument();
  });

  it('offline hint in the sheet when a spot is shown', async () => {
    const t = setup({ online: false, initial: stored });
    expect(
      screen.getByText('You are offline. Choosing a spot needs a connection.'),
    ).toBeInTheDocument();
    expect(t.useBtn).toBeDisabled();
  });

  describe('accessibility (axe)', () => {
    it('before searching', async () => {
      setup();
      expect(await axe(document.body)).toHaveNoViolations();
    });
    it('with search results open', async () => {
      const { input } = setup();
      await type(input, 'koh');
      await screen.findAllByRole('option');
      expect(await axe(document.body)).toHaveNoViolations();
    });
    it('with a place chosen', async () => {
      const { input } = setup();
      await pickFirst(input);
      expect(await axe(document.body)).toHaveNoViolations();
    });
  });

  it('removes the map when closed', () => {
    const t = setup({ initial: stored });
    const map = t.map;
    t.unmount();
    expect(map.removed).toBe(true);
  });
});
