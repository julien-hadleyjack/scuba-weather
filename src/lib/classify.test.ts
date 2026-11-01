import { describe, expect, it } from 'vitest';
import {
  classifyRain,
  classifyStorms,
  classifyWaveHour,
  classifyWaves,
  classifyWind,
  compass,
  strongestDirection,
} from './classify';
import { hours } from '../test/helpers';

/** Six hours of precipitation values. */
const rain = (...mm: (number | null)[]) => hours(mm.length, (i) => ({ precip: mm[i] }));

describe('rain', () => {
  it('Dry when no hour reaches 0.1 mm', () => {
    expect(classifyRain(rain(0, 0, 0.09, 0, 0, 0))).toEqual({ severity: 'ok', label: 'Dry', short: 'Dry' });
  });

  it('Drizzle at exactly 0.1 mm, still drizzle at 0.49', () => {
    expect(classifyRain(rain(0.1, 0, 0, 0, 0, 0)).label).toBe('Drizzle');
    expect(classifyRain(rain(0.49, 0.4, 0.4, 0.4, 0.4, 0.4))).toMatchObject({ label: 'Drizzle', severity: 'ok' });
  });

  it('a 0.5 mm hour is a rainy hour (Showers)', () => {
    const c = classifyRain(rain(0.5, 0, 0, 0, 0, 0));
    expect(c).toMatchObject({ label: 'Showers', severity: 'ok', detail: 'peak 0.5 mm/h' });
  });

  it('Showers become marginal at a peak of exactly 2.5 mm/h', () => {
    expect(classifyRain(rain(2.4, 0, 0, 0, 0, 0)).severity).toBe('ok');
    expect(classifyRain(rain(2.5, 0, 0, 0, 0, 0))).toMatchObject({ label: 'Showers', severity: 'marginal' });
    expect(classifyRain(rain(7.5, 0, 0, 0, 0, 0))).toMatchObject({ label: 'Showers', severity: 'marginal' });
  });

  it('Persistent when rainy hours are exactly half of the block', () => {
    expect(classifyRain(rain(1, 1, 1, 0, 0, 0))).toMatchObject({
      label: 'Persistent',
      severity: 'marginal',
      detail: 'peak 1.0 mm/h',
    });
    expect(classifyRain(rain(1, 1, 0, 0, 0, 0)).label).toBe('Showers');
  });

  it('Persistent below a 7.6 peak, Bursts from exactly 7.6', () => {
    expect(classifyRain(rain(7.5, 1, 1, 1, 0, 0)).label).toBe('Persistent');
    expect(classifyRain(rain(7.6, 0, 0, 0, 0, 0))).toMatchObject({ label: 'Bursts', severity: 'poor' });
    expect(classifyRain(rain(14, 1, 1, 1, 1, 1))).toMatchObject({ label: 'Bursts', detail: 'peak 14 mm/h' });
  });

  it('ignores missing hours and shows "–" without any data', () => {
    expect(classifyRain(rain(null, null, 1, 1, null, null)).label).toBe('Persistent');
    expect(classifyRain(rain(null, null))).toMatchObject({ severity: 'none', label: '–' });
  });

  it('works for a 4-hour Night block: 2 of 4 is persistent', () => {
    expect(classifyRain(rain(1, 1, 0, 0)).label).toBe('Persistent');
  });
});

describe('storms', () => {
  it('None by default', () => {
    expect(classifyStorms(hours(6, {}))).toMatchObject({ label: 'None', severity: 'ok' });
  });

  it('Possible needs a rainy hour with CAPE >= 1000', () => {
    expect(classifyStorms(hours(6, { precip: 0.5, cape: 1000 }))).toMatchObject({
      label: 'Possible',
      severity: 'marginal',
    });
    expect(classifyStorms(hours(6, { precip: 0.5, cape: 999 })).label).toBe('None');
    expect(classifyStorms(hours(6, { precip: 0.4, cape: 3000 })).label).toBe('None');
  });

  it.each([95, 96, 99])('Likely with weather code %i and the hour range', (code) => {
    const hrs = hours(6, (i) => ({ code: i === 2 || i === 3 ? code : 3 }), 12);
    expect(classifyStorms(hrs)).toEqual({ severity: 'poor', label: 'Likely', detail: '14–16', short: 'Likely' });
  });

  it('other codes (e.g. 82 violent showers) are not thunder', () => {
    expect(classifyStorms(hours(6, { code: 82 })).label).toBe('None');
  });

  it('pads single-digit hours', () => {
    expect(classifyStorms(hours(1, { code: 95 }, 6)).detail).toBe('06–07');
  });

  it('no data at all gives "–"', () => {
    expect(classifyStorms(hours(3, { code: null, cape: null })).severity).toBe('none');
  });
});

describe('wind', () => {
  it('OK below all thresholds', () => {
    expect(classifyWind(hours(6, { wind: 19.9, gust: 34.9 }))).toEqual({ severity: 'ok', label: 'OK', short: 'OK' });
  });

  it('marginal at exactly 20 km/h sustained or 35 km/h gusts', () => {
    expect(classifyWind(hours(6, { wind: 20, gust: 20 })).severity).toBe('marginal');
    expect(classifyWind(hours(6, { wind: 10, gust: 35 })).severity).toBe('marginal');
  });

  it('poor at exactly 29 km/h sustained or 45 km/h gusts', () => {
    expect(classifyWind(hours(6, { wind: 29, gust: 30 })).severity).toBe('poor');
    expect(classifyWind(hours(6, { wind: 10, gust: 45 })).severity).toBe('poor');
    expect(classifyWind(hours(6, { wind: 28.9, gust: 44.9 })).severity).toBe('marginal');
  });

  it('uses the strongest hour and formats the detail', () => {
    const hrs = hours(6, (i) => ({ wind: [10, 24.4, 12, 8, 8, 8][i], gust: [20, 41, 22, 15, 15, 15][i], dir: 225 }));
    expect(classifyWind(hrs)).toEqual({
      severity: 'marginal',
      label: 'Wind',
      detail: '24 km/h SW gusts 41',
      short: '24 km/h',
    });
  });

  it('direction comes from the hour with the strongest sustained wind', () => {
    const hrs = hours(3, (i) => ({ wind: [12, 25, 18][i], gust: [40, 30, 20][i], dir: [0, 90, 180][i] }));
    expect(classifyWind(hrs).detail).toBe('25 km/h E gusts 40');
  });

  it('no direction for the strongest hour: the direction is left out', () => {
    const hrs = hours(2, (i) => ({ wind: [25, 10][i], gust: 30, dir: [null, 90][i] }));
    expect(classifyWind(hrs).detail).toBe('25 km/h gusts 30');
  });

  it('no data gives "–"', () => {
    expect(classifyWind(hours(2, { wind: null, gust: null })).severity).toBe('none');
  });
});

describe('direction helpers', () => {
  it('compass points', () => {
    expect(compass(0)).toBe('N');
    expect(compass(22.4)).toBe('N');
    expect(compass(22.5)).toBe('NE');
    expect(compass(225)).toBe('SW');
    expect(compass(350)).toBe('N');
    expect(compass(-45)).toBe('NW');
  });

  it('strongest hour: earliest wins a tie; gusts are used without sustained data', () => {
    expect(strongestDirection(hours(2, (i) => ({ wind: 20, dir: [10, 200][i] })))).toBe(10);
    expect(strongestDirection(hours(2, (i) => ({ wind: null, gust: [30, 50][i], dir: [10, 200][i] })))).toBe(200);
    expect(strongestDirection([])).toBeNull();
  });
});

describe('waves', () => {
  it('height rule thresholds 1.0 and 2.0 (long period)', () => {
    expect(classifyWaveHour(0.99, 20).severity).toBe('ok');
    expect(classifyWaveHour(1.0, 20).severity).toBe('marginal');
    expect(classifyWaveHour(1.99, 20).severity).toBe('marginal');
    expect(classifyWaveHour(2.0, 20).severity).toBe('poor');
  });

  it('steep rule applies only when T < 6.5 × H', () => {
    // H 0.6 → limit 3.9 s
    expect(classifyWaveHour(0.6, 3.9).severity).toBe('ok');
    expect(classifyWaveHour(0.6, 3.8)).toMatchObject({ severity: 'marginal', steep: true });
    expect(classifyWaveHour(0.59, 2).severity).toBe('ok');
  });

  it('steep rule poor from exactly 1.25 m', () => {
    expect(classifyWaveHour(1.25, 5)).toMatchObject({ severity: 'poor', steep: true });
    expect(classifyWaveHour(1.24, 5)).toMatchObject({ severity: 'marginal', steep: true });
  });

  it('labels Choppy with period, Big waves with height', () => {
    expect(classifyWaves(hours(6, { waveH: 1.1, waveT: 5 }))).toEqual({
      severity: 'marginal',
      label: 'Choppy',
      detail: '1.1 m every 5 s',
      short: '1.1 m',
    });
    expect(classifyWaves(hours(6, { waveH: 2.1, waveT: 14 }))).toEqual({
      severity: 'poor',
      label: 'Big waves',
      detail: '2.1 m',
      short: '2.1 m',
    });
  });

  it('missing period uses the height rule only', () => {
    expect(classifyWaves(hours(2, { waveH: 1.2, waveT: null }))).toMatchObject({ label: 'Big waves' });
    expect(classifyWaves(hours(2, { waveH: 0.9, waveT: null })).label).toBe('OK');
  });

  it('the worst hour of the window wins', () => {
    const hrs = hours(6, (i) => ({ waveH: [0.3, 0.4, 1.3, 0.5, 2.2, 0.5][i], waveT: [9, 9, 5, 9, 15, 9][i] }));
    expect(classifyWaves(hrs)).toMatchObject({ severity: 'poor', label: 'Big waves', detail: '2.2 m' });
  });

  it('OK and no data', () => {
    expect(classifyWaves(hours(6, {})).label).toBe('OK');
    expect(classifyWaves(hours(2, { waveH: null })).severity).toBe('none');
  });
});
