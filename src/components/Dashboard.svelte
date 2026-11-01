<script lang="ts">
  import DayCard from './DayCard.svelte';
  import Icon from './Icon.svelte';
  import Outlook from './Outlook.svelte';
  import StatusBanner from './StatusBanner.svelte';
  import { buildDashboard } from '../lib/dashboard';
  import { pickBanner } from '../lib/status';
  import { ago } from '../lib/time';
  import type { AppState } from '../lib/app-state.svelte';

  let { app, onChangeSpot }: { app: AppState; onChangeSpot: () => void } = $props();

  let spot = $derived(app.spot!);
  let forecast = $derived(app.forecast);
  let view = $derived(forecast ? buildDashboard(forecast, app.now) : null);
  let banner = $derived(
    forecast
      ? pickBanner({
          nowMs: app.now,
          fetchedAt: forecast.fetchedAt,
          online: app.online,
          failed: app.failed,
          coversToday: view !== null,
        })
      : null,
  );
  let updated = $derived(
    forecast
      ? `Updated ${ago(forecast.fetchedAt, app.now)}`
      : null,
  );
  let dot = $derived(!app.online ? 'grey' : banner ? 'amber' : 'green');
</script>

<header class="header">
  <div class="top">
    <div class="title">
      <h1>{spot.name}</h1>
      {#if spot.region}<p class="region">{spot.region}</p>{/if}
    </div>
    <div class="actions">
      <button
        class="icon-btn"
        class:spinning={app.refreshing}
        aria-label={app.refreshing ? 'Refreshing forecast' : 'Refresh forecast'}
        disabled={app.refreshing || !app.online}
        onclick={() => app.refresh()}
      >
        <Icon name="refresh" size={20} />
      </button>
      <button class="icon-btn" aria-label="Change dive spot" onclick={onChangeSpot}>
        <Icon name="search" size={20} />
      </button>
    </div>
  </div>
  {#if updated}
    <p class="updated"><span class="dot {dot}" aria-hidden="true"></span>{updated}</p>
  {/if}
</header>

<main>
  {#if banner && banner.kind !== 'stale'}
    <div class="banner-wrap"><StatusBanner {banner} /></div>
  {/if}

  {#if !forecast}
    <div class="message" role="status">
      {#if app.refreshing}
        <p>Loading forecast…</p>
      {:else if !app.online}
        <p><strong>Offline.</strong> No forecast stored for this spot yet. It will load when you're back online.</p>
      {:else if app.failed}
        <p><strong>Couldn't load the forecast.</strong> Tap refresh to try again.</p>
      {:else}
        <p>No forecast yet. Tap refresh to load one.</p>
      {/if}
    </div>
  {:else if !view || banner?.kind === 'stale'}
    <div class="message stale" role="status">
      <p><strong>{banner?.title}</strong></p>
      <p>{banner?.text}</p>
    </div>
  {:else}
    <DayCard title="Today" day={view.today} />
    {#if view.tomorrow}<DayCard title="Tomorrow" day={view.tomorrow} />{/if}
    {#if view.outlook.length}<Outlook rows={view.outlook} />{/if}
  {/if}
</main>

<footer class="footer">
  <div class="legend" aria-label="Marker key">
    <span class="ok"><Icon name="check" size={14} />OK</span>
    <span><Icon name="triangle" size={14} color="var(--c-marginal-icon)" strokeWidth={2.2} />Marginal</span>
    <span><Icon name="octagon" size={14} color="var(--c-poor-icon)" strokeWidth={2.2} />Poor</span>
  </div>
  <p>
    Rain timing is approximate, especially for tropical downpours. Waves are open-water values on a grid of about
    8 km; sheltered bays may be calmer, exposed points rougher. Tides are model-based. Not a safety tool: the dive
    operator decides.
  </p>
  <p>
    Weather data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
    (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)
  </p>
</footer>

<style>
  .header {
    background: var(--c-surface);
    padding: calc(16px + env(safe-area-inset-top)) var(--s-5) 14px;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    border-bottom: 1px solid var(--c-border);
  }
  .top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--s-3);
  }
  .title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  h1 {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .region {
    font-size: 14px;
    color: var(--c-text-2);
  }
  .actions {
    display: flex;
    gap: var(--s-2);
  }
  .icon-btn:disabled {
    color: var(--c-text-3);
  }
  .spinning :global(svg) {
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .updated {
    font-size: 13px;
    color: var(--c-text-2);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    display: inline-block;
  }
  .dot.green {
    background: var(--c-good);
  }
  .dot.amber {
    background: var(--c-marginal-icon);
  }
  .dot.grey {
    background: var(--c-text-3);
  }
  .banner-wrap {
    padding: var(--s-4) var(--s-4) 0;
  }
  .message {
    margin: var(--s-5) var(--s-4) 0;
    padding: var(--s-4);
    border-radius: var(--r-card);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    font-size: 14px;
    line-height: 1.5;
    color: var(--c-text-2);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .message strong {
    color: var(--c-text);
  }
  .message.stale {
    background: var(--c-marginal-bg);
    border-color: transparent;
    color: var(--c-marginal-fg);
  }
  .message.stale strong {
    color: var(--c-marginal-fg);
  }
  .footer {
    padding: var(--s-6, 24px) var(--s-5) calc(32px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 12px;
    color: var(--c-text-2);
    line-height: 1.5;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-3);
    align-items: center;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
  }
  .legend .ok {
    color: var(--c-ok-fg);
  }
  a {
    color: var(--c-primary);
  }
</style>
