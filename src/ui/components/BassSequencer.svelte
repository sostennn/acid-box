<script lang="ts">
  import { holdContext, type BassPattern, type Command, type StepIndex } from '@engine';
  import PlayheadStrip from './PlayheadStrip.svelte';
  import StepCell from './StepCell.svelte';

  interface Props {
    pattern: BassPattern;
    activeStep: StepIndex | null;
    dispatch: (command: Command) => void;
  }

  const { pattern, activeStep, dispatch }: Props = $props();
</script>

<div class="sequencer">
  <PlayheadStrip step={activeStep} />
  <div class="grid" role="group" aria-label="Séquence basse">
    {#each pattern as step, index (index)}
      <StepCell
        index={index as StepIndex}
        {step}
        active={index === activeStep}
        held={holdContext(pattern, index as StepIndex).held}
        {dispatch}
      />
    {/each}
  </div>
</div>

<style>
  .sequencer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: var(--step-gap);
  }
</style>
