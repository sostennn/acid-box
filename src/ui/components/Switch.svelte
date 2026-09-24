<script lang="ts">
  interface Props {
    label: string;
    checked: boolean;
    /** La demande est prise en compte mais pas encore entendue (mute à la mesure). */
    pending?: boolean;
    onchange: (checked: boolean) => void;
  }

  const { label, checked, pending = false, onchange }: Props = $props();
</script>

<button
  type="button"
  class="switch"
  class:on={checked}
  class:pending
  role="switch"
  aria-checked={checked}
  onclick={() => onchange(!checked)}
>
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  <span class="label">{label}</span>
  {#if pending}
    <span class="visually-hidden">, en attente de la mesure suivante</span>
  {/if}
</button>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-size);
    padding: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
  }

  .switch:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .track {
    display: flex;
    width: var(--switch-width);
    height: var(--switch-height);
    padding: var(--switch-inset);
    border-radius: var(--radius-round);
    background: var(--switch-track-off);
    transition: background var(--duration-fast) var(--easing);
  }

  .thumb {
    aspect-ratio: 1;
    height: 100%;
    border-radius: var(--radius-round);
    background: var(--switch-thumb);
    transition: transform var(--duration-fast) var(--easing);
  }

  .on {
    color: var(--color-text);
  }

  .on .track {
    background: var(--switch-track-on);
  }

  .on .thumb {
    transform: translateX(var(--switch-travel));
  }

  .pending .track {
    animation: blink var(--duration-blink) steps(2, jump-none) infinite alternate;
  }

  @keyframes blink {
    to {
      opacity: var(--switch-pending-opacity);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pending .track {
      animation: none;
      opacity: var(--switch-pending-opacity);
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
