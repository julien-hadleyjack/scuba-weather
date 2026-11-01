import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DayCard from './DayCard.svelte';
import { sampleDashboard } from '../test/helpers';

describe('DayCard', () => {
  const view = sampleDashboard();

  it('renders the 4 × 3 grid and dims past blocks', () => {
    const { container } = render(DayCard, { title: 'Today', day: view.today });
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(container.querySelectorAll('[role="cell"] .cell')).toHaveLength(12);
    expect(screen.getByText('Bursts')).toBeInTheDocument();
    expect(screen.getByText('14–16')).toBeInTheDocument();
    // Morning is over at 13:00: header, 4 cells and chart part dimmed
    expect(container.querySelectorAll('.past')).toHaveLength(6);
    expect(container.textContent).toContain('Water 29 °C');
    expect(
      screen.getByRole('img', {
        name: /^Morning: .*\. Afternoon: rain in 1 of 6 hours, peak 14 mm\/h at 14:00.*\. Night: /,
      }),
    ).toBeInTheDocument();
  });
});
