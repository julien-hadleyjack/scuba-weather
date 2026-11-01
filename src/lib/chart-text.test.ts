import { describe, expect, it } from 'vitest';
import { describeBlock } from './chart-text';

const rain = (...mm: (number | null)[]) => mm.map((precip, i) => ({ hour: 12 + i, precip }));
const at = (start: number, ...mm: (number | null)[]) =>
  mm.map((precip, i) => ({ hour: start + i, precip }));

describe('chart text alternative', () => {
  it('dry, rising tide, light', () => {
    expect(describeBlock('Morning', rain(0, 0, 0), [0.1, 0.4, 0.8, 0.9], [], 12, 15)).toBe(
      'Morning: dry, tide rising',
    );
  });
  it('rain with peak, falling tide, partly dark', () => {
    expect(
      describeBlock(
        'Afternoon',
        rain(0, 2.4, 14, 0.3),
        [0.9, 0.6, 0.3, 0.2, 0.1],
        [[15.5, 22]],
        12,
        16,
      ),
    ).toBe('Afternoon: rain in 3 of 4 hours, peak 14 mm/h at 14:00, tide falling, partly dark');
  });
  it('fully dark, steady tide', () => {
    expect(describeBlock('Night', at(18, 0.5), [0.5, 0.55], [[17.9, 22]], 18, 19)).toBe(
      'Night: rain in 1 of 1 hours, peak 0.5 mm/h at 18:00, tide about steady, dark',
    );
  });
  it('missing data', () => {
    expect(describeBlock('Night', rain(null, null), [null, 0.5, null], [], 18, 20)).toBe(
      'Night: no rain data',
    );
  });
});
