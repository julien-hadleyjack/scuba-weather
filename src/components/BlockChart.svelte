<script lang="ts">
  import { curveMonotoneX, line } from 'd3-shape';
  import { RAIN_HEAVY, RAIN_MODERATE, RAINY_HOUR_MM, DRIZZLE_HOUR_MM } from '../lib/thresholds';
  import type { ChartHour } from '../lib/dashboard';

  let {
    start,
    end,
    hours,
    tide,
    night,
    ticks,
    label,
  }: {
    start: number;
    end: number;
    /** Rain for the block's hours. */
    hours: ChartHour[];
    /** Tide 0…1 for each hour start…end (inclusive). */
    tide: (number | null)[];
    night: [number, number][];
    ticks: number[];
    label: string;
  } = $props();

  const H = 90;
  const BASE = 74; // baseline of rain bars
  const TIDE_TOP = 6;
  const TIDE_RANGE = 22;

  let width = $state(0);
  let w = $derived(Math.max(width, 1));
  let n = $derived(end - start);
  let slot = $derived(w / n);
  const x = (h: number) => ((h - start) / n) * w;

  function bar(p: number | null): { h: number; fill: string; rx: number } {
    if (p === null || p < DRIZZLE_HOUR_MM) return { h: 1.5, fill: 'var(--c-rain-dry)', rx: 0 };
    if (p < RAINY_HOUR_MM) return { h: 3, fill: 'var(--c-rain-drizzle)', rx: 1 };
    const h = Math.min(68, Math.max(5, p * 2.85));
    const fill = p >= RAIN_HEAVY ? 'var(--c-rain-heavy)' : p >= RAIN_MODERATE ? 'var(--c-rain-moderate)' : 'var(--c-rain-light)';
    return { h, fill, rx: 1.5 };
  }

  let tidePath = $derived.by(() => {
    const pts = tide.map((v, i) => [x(start + i), v] as const);
    return (
      line<readonly [number, number | null]>()
        .defined((d) => d[1] !== null)
        .x((d) => d[0])
        .y((d) => TIDE_TOP + (1 - (d[1] as number)) * TIDE_RANGE)
        .curve(curveMonotoneX)(pts) ?? ''
    );
  });

  let shades = $derived(
    night
      .map(([a, b]) => [Math.max(a, start), Math.min(b, end)] as const)
      .filter(([a, b]) => b > a)
      .map(([a, b]) => ({ x: x(a), w: x(b) - x(a) })),
  );
</script>

<div class="chart" bind:clientWidth={width}>
  <svg width="100%" height={H} viewBox="0 0 {w} {H}" role="img" aria-label={label}>
    {#each shades as s, i (i)}
      <rect x={s.x} y="0" width={s.w} height={BASE} fill="var(--c-night)" />
    {/each}
    {#each hours as h, i (h.hour)}
      {@const b = bar(h.precip)}
      <rect
        x={i * slot + 1.5}
        y={BASE - b.h}
        width={Math.max(0, slot - 3)}
        height={b.h}
        rx={b.rx}
        fill={b.fill}
      />
    {/each}
    <line x1="0" y1={BASE} x2={w} y2={BASE} stroke="#B9C5CF" stroke-width="1" />
    {#if tidePath}
      <path d={tidePath} fill="none" stroke="var(--c-tide)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    {/if}
    {#each ticks as t (t)}
      <text
        x={x(t)}
        y="87"
        font-size="10"
        fill="var(--c-text-3)"
        text-anchor={t === start ? 'start' : t === end ? 'end' : 'middle'}>{String(t).padStart(2, '0')}</text
      >
    {/each}
  </svg>
</div>

<style>
  .chart {
    min-width: 0;
  }
  svg {
    display: block;
    overflow: visible;
    font-family: inherit;
  }
</style>
