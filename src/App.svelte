<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Dashboard from './components/Dashboard.svelte';
  import { AppState } from './lib/app-state.svelte';
  import type { Spot } from './lib/types';

  const app = new AppState();
  // First launch: no spot → spot screen (SPOT-1).
  let screen = $state<'dashboard' | 'spot'>(app.spot ? 'dashboard' : 'spot');

  // Map + Leaflet are only loaded when the spot screen opens (SPOT-9).
  const loadPicker = () => import('./components/SpotPicker.svelte');

  async function useSpot(spot: Spot) {
    screen = 'dashboard';
    window.scrollTo(0, 0);
    await app.chooseSpot(spot);
  }

  const onOnline = () => app.setOnline(true);
  const onOffline = () => app.setOnline(false);
  const onVisible = () => {
    if (document.visibilityState === 'visible') void app.autoRefresh();
  };
  let timer: ReturnType<typeof setInterval>;

  onMount(() => {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    timer = setInterval(() => app.tick(), 60_000);
    void app.autoRefresh();
  });

  onDestroy(() => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  });
</script>

{#if screen === 'spot'}
  {#await loadPicker()}
    <p class="loading">Loading map…</p>
  {:then { default: SpotPicker }}
    <SpotPicker
      initial={app.spot}
      online={app.online}
      onUse={useSpot}
      onBack={app.spot ? () => (screen = 'dashboard') : undefined}
    />
  {:catch}
    <p class="loading">The map couldn't be loaded. Check your connection and reopen the app.</p>
  {/await}
{:else}
  <Dashboard {app} onChangeSpot={() => (screen = 'spot')} />
{/if}

<style>
  .loading {
    padding: 40px 20px;
    text-align: center;
    color: var(--c-text-2);
    font-size: 14px;
  }
</style>
