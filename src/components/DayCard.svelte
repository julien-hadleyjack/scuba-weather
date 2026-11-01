<script lang="ts">
  import DayChart from './DayChart.svelte';
  import CellView from './CellView.svelte';
  import { describeBlock } from '../lib/chart-text';
  import { METRICS as rows } from '../lib/classify';
  import { DAY_START } from '../lib/thresholds';
  import { dayLabel, pad2 } from '../lib/time';
  import type { DayView } from '../lib/dashboard';

  let { title, day }: { title: string; day: DayView } = $props();

  let label = $derived(dayLabel(day.date));
  let headingId = $derived(`day-${day.date}`);
</script>

<section class="day" aria-labelledby={headingId}>
  <div class="heading">
    <h2 id={headingId}>{title}</h2>
    <span class="date">{label.weekday} {label.date}</span>
  </div>
  <div class="card">
    <div class="grid" role="table" aria-label="{title}: conditions by time of day">
      <div class="row" role="row">
        <span role="columnheader"><span class="visually-hidden">Metric</span></span>
        {#each day.blocks as b (b.id)}
          <span class="col-head" class:past={b.past} role="columnheader">
            {b.name}<span class="range">{pad2(b.start)}–{pad2(b.end)}</span>
            {#if b.past}<span class="visually-hidden">(over)</span>{/if}
          </span>
        {/each}
      </div>
      {#each rows as r (r.key)}
        <div class="row" role="row">
          <span class="row-head" role="rowheader">{r.name}</span>
          {#each day.blocks as b (b.id)}
            <div class:past={b.past} role="cell">
              <CellView cell={b.cells[r.key]} />
            </div>
          {/each}
        </div>
      {/each}
      <div class="row" role="row">
        <div class="chart-labels" role="rowheader">
          <span class="visually-hidden">Tide and rain</span>
          <span aria-hidden="true">Tide</span><span class="rain" aria-hidden="true">Rain</span>
        </div>
        <div class="chart-cell" role="cell" aria-colspan={day.blocks.length}>
          <DayChart
            chart={day.chart}
            blocks={day.blocks}
            label={day.blocks
              .map((b) => {
                const hours = day.chart.hours.filter((h) => h.hour >= b.start && h.hour < b.end);
                const tide = day.chart.tide.slice(b.start - DAY_START, b.end - DAY_START + 1);
                return describeBlock(b.name, hours, tide, day.chart.night, b.start, b.end);
              })
              .join('. ')}
          />
        </div>
      </div>
    </div>

    <div class="key" aria-hidden="true">
      <span><i class="k-tide"></i>Tide</span>
      <span><i class="k-night"></i>Night</span>
      <span><i class="k-rain"></i>Rain per hour</span>
    </div>

    <div class="water">
      Water <strong>{day.water === null ? '–' : `${day.water} °C`}</strong>
    </div>
  </div>
</section>

<style>
  .day {
    padding: var(--s-5) var(--s-4) 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .day + :global(.day) {
    padding-top: 28px;
  }
  .heading {
    display: flex;
    align-items: baseline;
    gap: var(--s-2);
  }
  h2 {
    font-size: 20px;
    font-weight: 700;
  }
  .date {
    font-size: 14px;
    color: var(--c-text-2);
  }
  .card {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-card);
    padding: var(--s-3) 10px;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .grid {
    display: grid;
    grid-template-columns: 52px repeat(3, minmax(0, 1fr));
    gap: 6px;
    align-items: stretch;
  }
  .row {
    display: contents;
  }
  .row > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .row > div > :global(.cell) {
    flex: 1;
  }
  .col-head {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    flex-direction: column;
  }
  .range {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-text-3);
  }
  .row-head {
    font-size: 12px;
    color: var(--c-text-2);
    align-self: center;
  }
  .past {
    opacity: 0.45;
  }
  .chart-cell {
    grid-column: 2 / -1;
  }
  .chart-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 76px;
    font-size: 12px;
    color: var(--c-text-2);
    padding-top: 8px;
  }
  .chart-labels .rain {
    padding-bottom: 6px;
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 11px;
    color: var(--c-text-2);
    padding: 0 2px;
  }
  .key span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .key i {
    display: inline-block;
  }
  .k-tide {
    width: 14px;
    height: 2px;
    background: var(--c-tide);
  }
  .k-night {
    width: 10px;
    height: 10px;
    background: #dde1e5;
  }
  .k-rain {
    width: 6px;
    height: 10px;
    background: var(--c-rain-moderate);
  }
  .water {
    font-size: 13px;
    color: var(--c-text-2);
    border-top: 1px solid var(--c-divider);
    padding: 10px 2px 0;
  }
  .water strong {
    color: var(--c-text);
    font-weight: 600;
  }
</style>
