<script lang="ts">
  // One continuous hourly chart for the day, 06–24, spanning all three block
  // columns (DASH-7). Each block's part is drawn in its own clipped group so a
  // block that is over can be dimmed on its own (DASH-9).
  import { curveMonotoneX, line } from 'd3-shape';
  import {
    RAIN_HEAVY,
    RAIN_MODERATE,
    RAINY_HOUR_MM,
    DRIZZLE_HOUR_MM,
    DAY_END,
    DAY_START,
  } from '../lib/thresholds';
  import type { BlockView, DayChart as ChartData } from '../lib/dashboard';
  import { pad2 } from '../lib/time';

  let {
    chart,
    blocks,
    label,
  }: {
    chart: ChartData;
    blocks: Pick<BlockView, 'id' | 'start' | 'end' | 'past'>[];
    label: string;
  } = $props();

  const uid = $props.id();
  const H = 90;
  const BASE = 74; // baseline of rain bars
  const TIDE_TOP = 6;
  const TIDE_RANGE = 22;
  const N = DAY_END - DAY_START;

  let width = $state(0);
  let w = $derived(Math.max(width, 1));
  let slot = $derived(w / N);
  const x = (h: number) => ((h - DAY_START) / N) * w;

  function bar(p: number | null): { h: number; fill: string; rx: number } {
    if (p === null || p < DRIZZLE_HOUR_MM) return { h: 1.5, fill: 'var(--c-rain-dry)', rx: 0 };
    if (p < RAINY_HOUR_MM) return { h: 3, fill: 'var(--c-rain-drizzle)', rx: 1 };
    const h = Math.min(68, Math.max(5, p * 2.85));
    const fill =
      p >= RAIN_HEAVY
        ? 'var(--c-rain-heavy)'
        : p >= RAIN_MODERATE
          ? 'var(--c-rain-moderate)'
          : 'var(--c-rain-light)';
    return { h, fill, rx: 1.5 };
  }

  let tidePath = $derived.by(() => {
    const pts = chart.tide.map((v, i) => [x(DAY_START + i), v] as const);
    return (
      line<readonly [number, number | null]>()
        .defined((d) => d[1] !== null)
        .x((d) => d[0])
        .y((d) => TIDE_TOP + (1 - (d[1] as number)) * TIDE_RANGE)
        .curve(curveMonotoneX)(pts) ?? ''
    );
  });

  let shades = $derived(
    chart.night
      .map(([a, b]) => [Math.max(a, DAY_START), Math.min(b, DAY_END)] as const)
      .filter(([a, b]) => b > a)
      .map(([a, b]) => ({ x: x(a), w: x(b) - x(a) })),
  );
</script>

<div class="chart" bind:clientWidth={width}>
  <svg width="100%" height={H} viewBox="0 0 {w} {H}" role="img" aria-label={label}>
    <defs>
      {#each blocks as b (b.id)}
        <clipPath id="{uid}-{b.id}">
          <rect x={x(b.start)} y="-4" width={x(b.end) - x(b.start)} height={BASE + 5} />
        </clipPath>
      {/each}
    </defs>
    {#each blocks as b (b.id)}
      <g class:past={b.past}>
        <g clip-path="url(#{uid}-{b.id})">
          {#each shades as s, i (i)}
            <rect x={s.x} y="0" width={s.w} height={BASE} fill="var(--c-night)" />
          {/each}
          {#each chart.hours.filter((h) => h.hour >= b.start && h.hour < b.end) as h (h.hour)}
            {@const r = bar(h.precip)}
            <rect
              x={x(h.hour) + 1.5}
              y={BASE - r.h}
              width={Math.max(0, slot - 3)}
              height={r.h}
              rx={r.rx}
              fill={r.fill}
            />
          {/each}
          <line x1="0" y1={BASE} x2={w} y2={BASE} stroke="#B9C5CF" stroke-width="1" />
          {#if tidePath}
            <path
              d={tidePath}
              fill="none"
              stroke="var(--c-tide)"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/if}
        </g>
        {#each chart.hours.filter((h) => h.hour >= b.start && h.hour < b.end && h.hour % 2 === 0) as h (h.hour)}
          <text
            x={x(h.hour + 0.5)}
            y="87"
            font-size="10"
            fill="var(--c-text-3)"
            text-anchor="middle">{pad2(h.hour)}</text
          >
        {/each}
      </g>
    {/each}
    {#each blocks.slice(1) as b (b.id)}
      <line class="boundary" x1={x(b.start)} y1="0" x2={x(b.start)} y2={BASE} />
    {/each}
  </svg>
</div>

<style>
  .chart {
    min-width: 0;
  }
  svg {
    display: block;
    font-family: inherit;
  }
  .past {
    opacity: 0.45;
  }
  .boundary {
    stroke: #b9c5cf;
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
</style>
