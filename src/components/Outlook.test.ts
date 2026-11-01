import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Outlook from './Outlook.svelte';
import { sampleDashboard } from '../test/helpers';

describe('Outlook', () => {
  const view = sampleDashboard();

  it('outlook shows one row per day', () => {
    const { container } = render(Outlook, { rows: view.outlook });
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
    expect(container.querySelectorAll('.cell.compact')).toHaveLength(12);
  });
});
