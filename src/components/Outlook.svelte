<script lang="ts">
  import CellView from './CellView.svelte';
  import { METRICS as cols } from '../lib/classify';
  import { dayLabel } from '../lib/time';
  import type { OutlookRow } from '../lib/dashboard';

  let { rows }: { rows: OutlookRow[] } = $props();
</script>

<section class="outlook" aria-labelledby="next-days">
  <h2 id="next-days">Next days</h2>
  <div class="card">
    <div class="grid" role="table" aria-label="Next days, 06–24">
      <div class="row" role="row">
        <span role="columnheader"><span class="visually-hidden">Day</span></span>
        {#each cols as c (c.key)}<span class="col-head" role="columnheader">{c.name}</span>{/each}
      </div>
      {#each rows as r (r.date)}
        {@const l = dayLabel(r.date)}
        <div class="row" role="row">
          <span class="day" role="rowheader"><strong>{l.weekday}</strong><span>{l.date}</span></span
          >
          {#each cols as c (c.key)}
            <div role="cell"><CellView cell={r.cells[c.key]} compact /></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .outlook {
    padding: 28px var(--s-4) 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  h2 {
    font-size: 20px;
    font-weight: 700;
  }
  .card {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-card);
    padding: var(--s-3) 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 40px repeat(4, minmax(0, 1fr));
    gap: 6px;
    align-items: stretch;
  }
  .row {
    display: contents;
  }
  .row > div {
    display: flex;
    min-width: 0;
  }
  .row > div > :global(.cell) {
    flex: 1;
  }
  .col-head {
    font-size: 12px;
    font-weight: 600;
    color: var(--c-text-2);
  }
  .day {
    display: flex;
    flex-direction: column;
    align-self: center;
  }
  .day strong {
    font-size: 14px;
    font-weight: 600;
  }
  .day span {
    font-size: 11px;
    color: var(--c-text-3);
  }
</style>
