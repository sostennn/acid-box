<script lang="ts">
  import { STEP_COUNT, type StepIndex } from '@engine';

  interface Props {
    step: StepIndex | null;
  }

  const { step }: Props = $props();
  const cells = Array.from({ length: STEP_COUNT }, (_, index) => index);
</script>

<div class="strip" aria-hidden="true">
  {#each cells as index (index)}
    <div class="cell" class:beat={index % 4 === 0} class:active={index === step}></div>
  {/each}
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: var(--space-1);
  }

  .cell {
    aspect-ratio: 2 / 1;
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
  }

  .cell.beat {
    background: var(--color-border);
  }

  .cell.active {
    background: var(--color-accent);
  }
</style>
