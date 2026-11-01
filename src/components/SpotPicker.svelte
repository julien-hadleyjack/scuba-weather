<script lang="ts">
  // "Choose dive spot" screen (SPOT-1…SPOT-10). Loaded lazily together with Leaflet.
  import 'leaflet/dist/leaflet.css';
  import L from 'leaflet';
  import { onDestroy, onMount, untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import { isOnWater, searchPlaces } from '../lib/api';
  import type { Place, Spot } from '../lib/types';

  let {
    initial,
    online,
    onUse,
    onBack,
  }: {
    initial: Spot | null;
    online: boolean;
    onUse: (spot: Spot) => void;
    onBack?: () => void;
  } = $props();

  // The screen starts from the stored spot (if any); later prop changes don't matter.
  const start = untrack(() => initial);

  // ---- search (accessible combobox) ----
  let query = $state('');
  let results = $state<Place[]>([]);
  let open = $state(false);
  let active = $state(-1);
  let searchState = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchAbort: AbortController | undefined;
  let input: HTMLInputElement;

  // ---- chosen place and pin ----
  let place = $state<{ name: string; region: string } | null>(start ? { name: start.name, region: start.region } : null);
  let center = $state<{ lat: number; lng: number }>(
    start ? { lat: start.latitude, lng: start.longitude } : { lat: 10, lng: 100 },
  );
  // Land check runs only when saving (SPOT-7); moving the map resets it.
  let check = $state<'idle' | 'checking' | 'land' | 'error'>('idle');
  let checkAbort: AbortController | undefined;

  let map: L.Map | undefined;

  function onInput() {
    cancelSearch();
    active = -1;
    const q = query.trim();
    if (q.length < 2) {
      results = [];
      open = false;
      searchState = 'idle';
      return;
    }
    searchTimer = setTimeout(() => runSearch(q), 300);
  }

  async function runSearch(q: string) {
    const ctrl = (searchAbort = new AbortController());
    searchState = 'loading';
    open = true;
    try {
      const found = await searchPlaces(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      results = found;
      searchState = 'done';
    } catch {
      if (ctrl.signal.aborted) return;
      results = [];
      searchState = 'error';
    }
  }

  function cancelSearch() {
    clearTimeout(searchTimer);
    searchAbort?.abort();
  }

  function choose(p: Place) {
    // SPOT-2: no late results reopen the list; SPOT-5: a new place clears the check.
    cancelSearch();
    searchState = 'idle';
    checkAbort?.abort();
    check = 'idle';
    place = { name: p.name, region: p.region };
    query = p.name;
    open = false;
    results = [];
    active = -1;
    center = { lat: p.latitude, lng: p.longitude };
    // With a map: setView fires moveend → pin check. Without one yet, the map
    // is created once the place is set (see `mapAction`).
    map?.setView([p.latitude, p.longitude], 12);
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') open = false;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = active <= 0 ? results.length - 1 : active - 1;
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      open = false;
      active = -1;
    }
  }

  function clear() {
    query = '';
    results = [];
    open = false;
    searchState = 'idle';
    input.focus();
  }

  function updateCenter() {
    if (!map) return;
    const c = map.getCenter().wrap();
    center = { lat: c.lat, lng: c.lng };
  }

  async function use() {
    if (!place || check === 'checking' || check === 'land') return;
    const spot = { name: place.name, region: place.region, latitude: center.lat, longitude: center.lng };
    checkAbort = new AbortController();
    check = 'checking';
    try {
      const onWater = await isOnWater(spot.latitude, spot.longitude, checkAbort.signal);
      if (onWater) {
        check = 'idle';
        onUse(spot);
      } else check = 'land';
    } catch (e) {
      if ((e as Error).name !== 'AbortError') check = 'error';
    }
  }

  function coord(v: number, pos: string, neg: string): string {
    return `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
  }

  /** Creates the Leaflet map once a place is chosen (no map before the first search). */
  function mapAction(el: HTMLDivElement) {
    map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([center.lat, center.lng], 12);
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('movestart', () => {
      checkAbort?.abort();
      check = 'idle';
    });
    map.on('moveend', updateCenter);
  }

  onMount(() => {
    if (!start) input?.focus();
  });

  onDestroy(() => {
    cancelSearch();
    checkAbort?.abort();
    map?.remove();
  });

  let canUse = $derived(online && check !== 'checking' && check !== 'land');
  let hint = $derived.by(() => {
    if (!online) return 'You are offline. Choosing a spot needs a connection.';
    if (check === 'land') return 'Move the pin onto open water, then try again.';
    if (check === 'error') return "Couldn't check this position. Tap the button to try again.";
    return 'Drag the map to move the pin onto open water close to your dive site.';
  });
</script>

<div class="screen">
  <header class="header">
    <div class="bar">
      {#if onBack}
        <button class="back" aria-label="Back to dashboard" onclick={onBack}><Icon name="back" size={22} /></button>
      {/if}
      <h1>Choose dive spot</h1>
    </div>
    <label for="place-search" class="label" id="place-search-label">Search a place, island or dive site</label>
    <div class="field">
      <Icon name="search" size={18} color="var(--c-text-2)" />
      <input
        bind:this={input}
        id="place-search"
        type="search"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="place-results"
        aria-activedescendant={active >= 0 ? `place-${results[active]?.id}` : undefined}
        bind:value={query}
        oninput={onInput}
        onkeydown={onKeydown}
        onfocus={() => {
          if (results.length) open = true;
        }}
      />
      {#if query}
        <button class="clear" aria-label="Clear search" onclick={clear}><Icon name="close" size={16} /></button>
      {/if}
    </div>
  </header>

  <div class="map-wrap" class:empty={!place}>
    {#if place}
      <div class="map" use:mapAction></div>
      <div class="pin" aria-hidden="true">
        <svg width="36" height="46" viewBox="0 0 36 46">
          <ellipse cx="18" cy="44" rx="8" ry="2.5" fill="#0E1A26" opacity="0.25" />
          <path d="M18 44 C 18 44, 1 23, 1 17 A 17 17 0 0 1 35 17 C 35 23, 18 44, 18 44 Z" fill="#0A5F86" stroke="#fff" stroke-width="2" />
          <circle cx="18" cy="17" r="6" fill="#fff" />
        </svg>
      </div>
      <div class="zoom">
        <button class="icon-btn" aria-label="Zoom in" onclick={() => map?.zoomIn()}><Icon name="plus" size={18} /></button>
        <button class="icon-btn" aria-label="Zoom out" onclick={() => map?.zoomOut()}><Icon name="minus" size={18} /></button>
      </div>
    {:else}
      <div class="placeholder">
        <Icon name="search" size={32} color="var(--c-primary)" />
        {#if online}
          <p>Search for a place, island or dive site above.</p>
        {:else}
          <p>You are offline. Choosing a dive spot needs a connection.</p>
        {/if}
      </div>
    {/if}

    <ul id="place-results" role="listbox" aria-labelledby="place-search-label" class="results" hidden={!open}>
      {#if searchState === 'loading' && results.length === 0}
        <li class="note" role="presentation">Searching…</li>
      {:else if searchState === 'error'}
        <li class="note" role="presentation">Search failed. Check your connection.</li>
      {:else if searchState === 'done' && results.length === 0}
        <li class="note" role="presentation">No places found.</li>
      {/if}
      {#each results as r, i (r.id)}
        <li
          id="place-{r.id}"
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(r)}
          onkeydown={() => {}}
        >
          <Icon name="pin" size={20} color="var(--c-primary)" />
          <span class="r-text"><strong>{r.name}</strong>{#if r.region}<span>{r.region}</span>{/if}</span>
        </li>
      {/each}
    </ul>
  </div>

  {#if place}
  <div class="sheet">
    <div class="sheet-top">
      <div class="place">
        <strong>{place.name}</strong>
        {#if place.region}<span>{place.region}</span>{/if}
      </div>
      <span class="coords">{coord(center.lat, 'N', 'S')}, {coord(center.lng, 'E', 'W')}</span>
    </div>
    {#if check === 'land' || check === 'error'}
      <span class="chip" role="status">
        <Icon name="triangle" size={14} color="var(--c-marginal-icon)" strokeWidth={2.2} />
        {check === 'land' ? 'Pin is on land' : 'Check failed'}
      </span>
    {/if}
    <p class="hint">{hint}</p>
    <button class="use" disabled={!canUse} aria-busy={check === 'checking'} onclick={use}>
      {#if check === 'checking'}<span class="spinner light" aria-hidden="true"></span>Checking position…{:else}Use this spot{/if}
    </button>
  </div>
  {/if}
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }
  .header {
    background: var(--c-surface);
    padding: calc(10px + env(safe-area-inset-top)) var(--s-4) 14px;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    border-bottom: 1px solid var(--c-border);
    position: relative;
    z-index: 1001;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    min-height: var(--touch);
  }
  .back {
    width: var(--touch);
    height: var(--touch);
    border-radius: var(--r-btn);
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
  }
  h1 {
    font-size: 18px;
    font-weight: 700;
  }
  .label {
    font-size: 13px;
    color: var(--c-text-2);
    padding: 0 4px;
  }
  .field {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    height: 48px;
    border: 2px solid var(--c-primary);
    border-radius: var(--r-btn);
    padding: 0 6px 0 12px;
    background: var(--c-surface);
  }
  .field :global(svg) {
    flex-shrink: 0;
  }
  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    font: inherit;
    font-size: 16px;
    color: var(--c-text);
    background: transparent;
    height: 100%;
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    width: 36px;
    height: 36px;
    border-radius: 18px;
    border: none;
    background: var(--c-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-text-2);
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .map-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    background: #bfdceb;
    overflow: hidden;
  }
  .map {
    position: absolute;
    inset: 0;
  }
  .map-wrap.empty {
    background: var(--c-bg);
  }
  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--s-2);
    padding: var(--s-5) 32px;
    text-align: center;
    color: var(--c-text-2);
    font-size: 14px;
    line-height: 1.5;
  }

  .pin {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-18px, -44px);
    z-index: 500;
    pointer-events: none;
  }
  .zoom {
    position: absolute;
    right: 12px;
    top: 12px;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    z-index: 600;
  }
  .zoom .icon-btn {
    color: var(--c-text);
  }
  .results {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
    box-shadow: 0 6px 16px rgba(14, 26, 38, 0.12);
    z-index: 1000;
  }
  .results[hidden] {
    display: none;
  }
  .results li {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-3) var(--s-4);
    border-bottom: 1px solid var(--c-divider);
    min-height: 60px;
    cursor: pointer;
  }
  .results li:last-child {
    border-bottom: none;
  }
  .results li.active,
  .results li[role='option']:hover {
    background: var(--c-ok-bg);
  }
  .results li :global(svg) {
    flex-shrink: 0;
  }
  .results .note {
    color: var(--c-text-2);
    font-size: 14px;
    cursor: default;
    min-height: 48px;
  }
  .r-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .r-text strong {
    font-size: 16px;
    font-weight: 600;
  }
  .r-text span {
    font-size: 13px;
    color: var(--c-text-2);
  }
  .sheet {
    background: var(--c-surface);
    border-radius: var(--r-sheet) var(--r-sheet) 0 0;
    margin-top: -16px;
    position: relative;
    z-index: 1001;
    padding: var(--s-5) var(--s-5) calc(24px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 -2px 12px rgba(14, 26, 38, 0.08);
  }
  .sheet-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--s-2);
  }
  .place {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .place strong {
    font-size: 18px;
    font-weight: 700;
  }
  .place span {
    font-size: 13px;
    color: var(--c-text-2);
  }
  .coords {
    font-size: 12px;
    color: var(--c-text-3);
    padding-top: 4px;
    white-space: nowrap;
  }
  .chip {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--r-cell);
    background: var(--c-marginal-bg);
    color: var(--c-marginal-fg);
    font-size: 13px;
    font-weight: 600;
  }

  .hint {
    font-size: 13px;
    color: var(--c-text-2);
    line-height: 1.5;
  }
  .use {
    height: 52px;
    border-radius: var(--r-card);
    border: none;
    background: var(--c-primary);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-2);
    cursor: pointer;
  }
  .use:disabled {
    background: var(--c-border);
    color: var(--c-text-2);
    cursor: default;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-right-color: transparent;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  :global(.leaflet-control-attribution) {
    font-size: 10px;
    margin-bottom: 18px !important;
  }
</style>
