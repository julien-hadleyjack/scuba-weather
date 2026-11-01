import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatusBanner from './StatusBanner.svelte';

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
