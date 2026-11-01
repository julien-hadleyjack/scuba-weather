<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Severity } from '../lib/types';

  let { severity, size = 13 }: { severity: Severity; size?: number } = $props();
</script>

{#if severity === 'poor'}
  <Icon name="octagon" {size} color="var(--c-poor-icon)" />
{:else if severity === 'marginal'}
  <Icon name="triangle" {size} color="var(--c-marginal-icon)" />
{:else if severity === 'ok'}
  <Icon name="check" {size} />
{/if}
