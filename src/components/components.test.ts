import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CellView from './CellView.svelte';
import StatusBanner from './StatusBanner.svelte';
import DayCard from './DayCard.svelte';
import Outlook from './Outlook.svelte';
import { buildDashboard } from '../lib/dashboard';
import { forecast } from '../test/helpers';

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

describe('StatusBanner', () => {
  it('offline banner is grey with the text', () => {
    render(StatusBanner, { banner: { kind: 'offline', tone: 'grey', text: 'Offline · forecast from 07:12, 5 h ago' } });
    const b = screen.getByRole('status');
    expect(b).toHaveClass('grey');
    expect(b).toHaveTextContent('Offline · forecast from 07:12, 5 h ago');
  });

  it('failed banner is amber and has no button of its own', () => {
    render(StatusBanner, {
      banner: { kind: 'failed', tone: 'amber', text: "Couldn't update. Showing forecast from 07:12, 3 h ago. Tap refresh to try again." },
    });
    const b = screen.getByRole('status');
    expect(b).toHaveClass('amber');
    expect(b.querySelector('button')).toBeNull();
  });
});

describe('DayCard and Outlook', () => {
  const f = forecast('2026-11-01', 5, (h) => ({
    precip: h.hour === 14 ? 14 : 0,
    code: h.hour === 14 || h.hour === 15 ? 95 : 1,
  }));
  // 13:00 at the spot
  const view = buildDashboard(f, Date.UTC(2026, 10, 1, 6))!;

  it('renders the 4 × 3 grid and dims past blocks', () => {
    const { container } = render(DayCard, { title: 'Today', day: view.today });
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(container.querySelectorAll('[role="cell"] .cell')).toHaveLength(12);
    expect(screen.getByText('Bursts')).toBeInTheDocument();
    expect(screen.getByText('14–16')).toBeInTheDocument();
    // Morning is over at 13:00: header, 4 cells and chart part dimmed
    expect(container.querySelectorAll('.past')).toHaveLength(6);
    expect(container.textContent).toContain('Water 29 °C');
    expect(screen.getByRole('img', { name: /Afternoon: rain in 1 of 6 hours, peak 14 mm\/h at 14:00/ })).toBeInTheDocument();
  });

  it('outlook shows one row per day', () => {
    const { container } = render(Outlook, { rows: view.outlook });
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
    expect(container.querySelectorAll('.cell.compact')).toHaveLength(12);
  });
});
