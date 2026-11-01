<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Banner } from '../lib/status';

  let { banner }: { banner: Banner } = $props();
</script>

<div class="banner {banner.tone}" role="status" data-kind={banner.kind}>
  {#if banner.tone === 'grey'}
    <Icon name="wifi-off" size={16} />
  {:else}
    <Icon name="triangle" size={18} color="var(--c-marginal-icon)" strokeWidth={2.2} />
  {/if}
  <span>{banner.text}</span>
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: var(--r-card);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
  }
  .banner :global(svg) {
    flex-shrink: 0;
  }
  .grey {
    background: var(--c-info-bg);
    color: var(--c-ok-fg);
    border-radius: var(--r-cell);
    padding: 8px 10px;
  }
  .amber {
    background: var(--c-marginal-bg);
    color: var(--c-marginal-fg);
  }
</style>
