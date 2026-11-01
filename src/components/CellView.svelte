<script lang="ts">
  import SeverityIcon from './SeverityIcon.svelte';
  import type { Cell } from '../lib/types';

  let {
    cell,
    compact = false,
    context = '',
  }: { cell: Cell; compact?: boolean; context?: string } = $props();

  const severityText = { ok: 'OK', marginal: 'Marginal', poor: 'Poor', none: 'No data' };
  // Keep numbers and units together ("14 mm/h", "5 s") so they never wrap apart.
  const glue = (t: string | undefined) => t?.replace(/(\d) (?=mm\/h|km\/h|m\b|s\b)/g, '$1\u00a0');
  let text = $derived(glue(compact ? cell.short : cell.label));
  let detail = $derived(compact ? undefined : glue(cell.detail));
  // OK cells read "OK" already; for others, say the severity explicitly for screen readers.
  let srPrefix = $derived(
    cell.severity === 'none'
      ? 'No data'
      : cell.severity === 'ok' && text === 'OK'
        ? ''
        : severityText[cell.severity],
  );
</script>

<div class="cell {cell.severity}" class:compact data-severity={cell.severity}>
  <span class="visually-hidden">{context}{context ? ': ' : ''}{srPrefix}{srPrefix ? ', ' : ''}</span
  >
  <span class="main">
    <SeverityIcon severity={cell.severity} size={compact ? 12 : 13} />
    <span aria-hidden={cell.severity === 'none' ? 'true' : undefined}>{text}</span>
  </span>
  {#if detail}<span class="detail">{detail}</span>{/if}
</div>

<style>
  .cell {
    border-radius: var(--r-cell);
    padding: var(--s-2) 7px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
    min-height: 40px;
    min-width: 0;
    overflow-wrap: normal;
    /* Narrow Night cells: break long words ("Persis-tent") rather than overflow. */
    hyphens: auto;
  }
  .compact {
    padding: 6px 7px;
    font-size: 12px;
    line-height: 1.2;
  }
  .main {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px var(--s-1);
  }
  .main :global(svg) {
    flex-shrink: 0;
  }
  .detail {
    font-size: 12px;
    font-weight: 400;
  }
  .ok {
    background: var(--c-ok-bg);
    color: var(--c-ok-fg);
  }
  .ok .detail {
    color: var(--c-text-2);
  }
  .marginal {
    background: var(--c-marginal-bg);
    color: var(--c-marginal-fg);
  }
  .poor {
    background: var(--c-poor-bg);
    color: var(--c-poor-fg);
  }
  .none {
    background: var(--c-ok-bg);
    color: var(--c-text-3);
    font-weight: 400;
  }
</style>
