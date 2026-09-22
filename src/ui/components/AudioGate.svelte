<script lang="ts">
  import type { AudioAvailability } from '@engine';

  interface Props {
    availability: AudioAvailability;
    onunlock: () => void;
  }

  const { availability, onunlock }: Props = $props();

  const label = $derived(
    availability === 'interrupted'
      ? 'Audio interrompu — toucher pour reprendre'
      : 'Toucher pour démarrer',
  );
</script>

<div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
  {#if availability === 'unavailable'}
    <p id="gate-title" class="title">Web Audio est indisponible dans ce navigateur.</p>
  {:else}
    <p id="gate-title" class="title">acid-box</p>
    <p class="hint">Le navigateur exige un geste avant de produire du son.</p>
    <button type="button" class="start" onclick={onunlock}>{label}</button>
  {/if}
</div>

<style>
  .gate {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-6);
    background: var(--color-bg);
    text-align: center;
  }

  .title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
  }

  .hint {
    margin: 0;
    color: var(--color-text-muted);
  }

  .start {
    min-height: var(--control-size);
    padding: var(--space-3) var(--space-6);
    border: none;
    border-radius: var(--radius-round);
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    transition: transform var(--duration-fast) var(--easing);
  }

  .start:active {
    transform: scale(0.97);
  }
</style>
