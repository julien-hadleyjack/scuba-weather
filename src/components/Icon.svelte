<script lang="ts" module>
  export type IconName =
    | 'check'
    | 'triangle'
    | 'octagon'
    | 'refresh'
    | 'search'
    | 'back'
    | 'close'
    | 'pin'
    | 'wifi-off'
    | 'plus'
    | 'minus';
</script>

<script lang="ts">
  let {
    name,
    size = 16,
    color = 'currentColor',
    strokeWidth,
  }: { name: IconName; size?: number; color?: string; strokeWidth?: number } = $props();

  const defaults: Record<IconName, number> = {
    check: 2.6,
    triangle: 2.4,
    octagon: 2.4,
    refresh: 2,
    search: 2,
    back: 2,
    close: 2.2,
    pin: 2,
    'wifi-off': 2,
    plus: 2.2,
    minus: 2.2,
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth ?? defaults[name]}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'check'}
    <path d="M20 6 9 17l-5-5" />
  {:else if name === 'triangle'}
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  {:else if name === 'octagon'}
    <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z" />
    <path d="M15 9l-6 6M9 9l6 6" />
  {:else if name === 'refresh'}
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
    <path d="M21 3v5h-5" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  {:else if name === 'back'}
    <path d="M19 12H5M12 19l-7-7 7-7" />
  {:else if name === 'close'}
    <path d="M18 6 6 18M6 6l12 12" />
  {:else if name === 'pin'}
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  {:else if name === 'wifi-off'}
    <path
      d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M16.8 13.4a10 10 0 0 0-2.4-1.6M12 20h.01"
    />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'minus'}
    <path d="M5 12h14" />
  {/if}
</svg>
