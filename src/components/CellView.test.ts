import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import CellView from './CellView.svelte';

describe('CellView', () => {
  it('OK cell: check icon, grey style, label only', () => {
    const { container } = render(CellView, { cell: { severity: 'ok', label: 'Dry', short: 'Dry' } });
    const cell = container.querySelector('.cell')!;
    expect(cell).toHaveClass('ok');
    expect(cell).toHaveTextContent('Dry');
    expect(cell.querySelector('svg path')!.getAttribute('d')).toBe('M20 6 9 17l-5-5');
    expect(cell.querySelector('.detail')).toBeNull();
  });

  it('marginal cell: triangle icon, amber style, detail line, severity in text', () => {
    const { container } = render(CellView, {
      props: {
        cell: { severity: 'marginal', label: 'Wind', detail: '24 km/h SW gusts 41', short: '24 km/h' },
        context: 'Afternoon Wind',
      },
    });
    const cell = container.querySelector('.cell')!;
    expect(cell).toHaveClass('marginal');
    expect(cell).toHaveTextContent('24 km/h SW gusts 41');
    expect(cell).toHaveTextContent('Marginal');
    expect(cell.querySelectorAll('svg path')).toHaveLength(2);
  });

  it('poor cell: octagon icon, red style', () => {
    const { container } = render(CellView, {
      cell: { severity: 'poor', label: 'Bursts', detail: 'peak 14 mm/h', short: 'Bursts' },
    });
    expect(container.querySelector('.cell')).toHaveClass('poor');
    expect(container.querySelector('svg path')!.getAttribute('d')).toContain('M7.9 2h8.2');
  });

  it('compact cell uses the short text and no detail', () => {
    const { container } = render(CellView, {
      cell: { severity: 'poor', label: 'Big waves', detail: '2.1 m', short: '2.1 m' },
      compact: true,
    });
    expect(container.querySelector('.cell')).toHaveClass('compact');
    expect(container.querySelector('.detail')).toBeNull();
    expect(container.querySelector('.main')).toHaveTextContent('2.1 m');
  });

  it('no data cell shows a dash, neutral', () => {
    const { container } = render(CellView, { cell: { severity: 'none', label: '–', short: '–' } });
    expect(container.querySelector('.cell')).toHaveClass('none');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.cell')).toHaveTextContent('–');
  });
});
