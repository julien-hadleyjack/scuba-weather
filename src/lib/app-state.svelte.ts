// App-wide state and refresh behaviour (DATA-3, DATA-6, DATA-7, OFF-2).
import { fetchForecast as defaultFetch } from './api';
import * as storage from './storage';
import { shouldAutoRefresh } from './status';
import type { Forecast, Spot } from './types';

export interface Deps {
  fetchForecast: (spot: Spot) => Promise<Forecast>;
  loadSpot: () => Spot | null;
  saveSpot: (s: Spot) => void;
  loadForecast: () => Forecast | null;
  saveForecast: (f: Forecast) => void;
  now: () => number;
  online: () => boolean;
}

const defaultDeps: Deps = {
  fetchForecast: (s) => defaultFetch(s),
  loadSpot: storage.loadSpot,
  saveSpot: storage.saveSpot,
  loadForecast: storage.loadForecast,
  saveForecast: storage.saveForecast,
  now: () => Date.now(),
  online: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
};

export class AppState {
  spot = $state.raw<Spot | null>(null);
  forecast = $state.raw<Forecast | null>(null);
  refreshing = $state(false);
  failed = $state(false);
  online = $state(true);
  now = $state(0);

  private deps: Deps;
  /** Id of the latest refresh; older ones are ignored when they finish (SPOT-8). */
  private refreshId = 0;

  constructor(deps: Partial<Deps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
    this.spot = this.deps.loadSpot();
    const f = this.deps.loadForecast();
    this.forecast = f && this.spot && storage.sameSpot(f, this.spot) ? f : null;
    this.online = this.deps.online();
    this.now = this.deps.now();
  }

  tick(): void {
    this.now = this.deps.now();
  }

  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    // Going offline clears a failed refresh (OFF-4).
    if (!online) this.failed = false;
    this.tick();
    if (online) void this.autoRefresh();
  }

  /** On open and when the app returns to the foreground (DATA-6). */
  async autoRefresh(): Promise<void> {
    this.tick();
    if (!this.spot) return;
    if (shouldAutoRefresh(this.forecast?.fetchedAt ?? null, this.now, this.online))
      await this.refresh();
  }

  /** Manual or automatic refresh. Only counts when both requests succeed. */
  async refresh(): Promise<void> {
    const spot = this.spot;
    if (!spot || this.refreshing) return;
    if (!this.deps.online()) {
      this.setOnline(false);
      return;
    }
    const id = ++this.refreshId;
    this.refreshing = true;
    try {
      const f = await this.deps.fetchForecast(spot);
      if (id !== this.refreshId) return; // superseded, e.g. the spot changed
      this.forecast = f;
      this.deps.saveForecast(f);
      this.failed = false;
    } catch {
      if (id !== this.refreshId) return;
      this.failed = true;
      if (!this.deps.online()) this.setOnline(false);
    } finally {
      if (id === this.refreshId) {
        this.refreshing = false;
        this.tick();
      }
    }
  }

  async chooseSpot(spot: Spot): Promise<void> {
    this.deps.saveSpot(spot);
    this.spot = spot;
    this.forecast = null;
    this.failed = false;
    // A refresh still running for the previous spot is ignored (SPOT-8).
    this.refreshId++;
    this.refreshing = false;
    await this.refresh();
  }
}
