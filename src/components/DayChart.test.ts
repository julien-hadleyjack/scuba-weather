import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DayChart from './DayChart.svelte';
import { sampleDashboard } from '../test/helpers';

describe('DayChart', () => {
  const { today } = sampleDashboard();
  const show = () =>
    render(DayChart, { chart: today.chart, blocks: today.blocks, label: 'Chart text' });

  it('draws one continuous chart for the day with 2-hour labels under the bars (DASH-7)', () => {
    const { container } = show();
    const svg = screen.getByRole('img', { name: 'Chart text' });
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    const labels = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toEqual(['06', '08', '10', '12', '14', '16', '18', '20', '22']);
    expect(svg.querySelectorAll('line.boundary')).toHaveLength(2);
  });

  it('draws one bar per hour, each in its block', () => {
    const { container } = show();
    const groups = container.querySelectorAll('svg > g');
    expect(groups).toHaveLength(3);
    // 6 bars per block (night shading starts at y=0 and is left out)
    for (const g of groups) expect(g.querySelectorAll('rect:not([y="0"])')).toHaveLength(6);
  });

  it('dims only the part of a block that is over (DASH-9)', () => {
    const { container } = show();
    const groups = [...container.querySelectorAll('svg > g')];
    expect(groups.map((g) => g.classList.contains('past'))).toEqual([true, false, false]);
  });
});
