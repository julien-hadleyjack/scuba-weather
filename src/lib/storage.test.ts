import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadForecast, loadSpot, sameSpot, saveForecast, saveSpot } from './storage';
import { forecast } from '../test/helpers';
import type { Spot } from './types';

const spot: Spot = { name: 'Chalok Bay', region: 'Surat Thani, Thailand', latitude: 10, longitude: 99.8 };

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when nothing is stored', () => {
    expect(loadSpot()).toBeNull();
    expect(loadForecast()).toBeNull();
  });

  it('round-trips spot and forecast', () => {
    saveSpot(spot);
    const f = forecast();
    saveForecast(f);
    expect(loadSpot()).toEqual(spot);
    expect(loadForecast()).toEqual(f);
  });

  it('ignores corrupt or incomplete data', () => {
    localStorage.setItem('scuba-weather.spot.v1', '{not json');
    localStorage.setItem('scuba-weather.forecast.v1', JSON.stringify({ hours: 'nope' }));
    expect(loadSpot()).toBeNull();
    expect(loadForecast()).toBeNull();
    localStorage.setItem('scuba-weather.spot.v1', JSON.stringify({ name: 'x' }));
    expect(loadSpot()).toBeNull();
  });

  it('choosing a different spot drops the stored forecast, the same spot keeps it', () => {
    saveSpot(spot);
    saveForecast(forecast());
    saveSpot({ ...spot, name: 'Renamed' });
    expect(loadForecast()).not.toBeNull();
    saveSpot({ ...spot, latitude: 7.6, longitude: 98.4 });
    expect(loadForecast()).toBeNull();
    expect(loadSpot()!.latitude).toBe(7.6);
  });

  it('survives blocked or full storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveForecast(forecast())).not.toThrow();
    expect(() => saveSpot(spot)).not.toThrow();
  });

  it('removeItem failure is ignored when switching spots', () => {
    localStorage.setItem('scuba-weather.forecast.v1', JSON.stringify(forecast()));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveSpot({ ...spot, latitude: 1, longitude: 1 })).not.toThrow();
  });

  it('sameSpot compares coordinates', () => {
    expect(sameSpot({ latitude: 10, longitude: 99.8 }, spot)).toBe(true);
    expect(sameSpot({ latitude: 10.001, longitude: 99.8 }, spot)).toBe(false);
  });
});
