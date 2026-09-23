<script lang="ts">
  import {
    PITCH_RANGE_SEMITONES,
    indexToPitch,
    pitchLabel,
    pitchToIndex,
    type Command,
    type Step,
    type StepIndex,
  } from '@engine';
  import { knobDrag } from '../gestures/knob-drag';

  interface Props {
    index: StepIndex;
    step: Step;
    active: boolean;
    /** Le pas hérite de la note en cours (le pas joué précédent porte un slide). */
    held: boolean;
    dispatch: (command: Command) => void;
  }

  const { index, step, active, held, dispatch }: Props = $props();

  const maxIndex = PITCH_RANGE_SEMITONES - 1;
  /** C2, milieu de la plage : cible du double-tap. */
  const defaultPitch = pitchToIndex({ note: 0, octave: 0 }) / maxIndex;
  const label = $derived(pitchLabel(step));

  function setPitch(normalized: number) {
    const pitch = indexToPitch(normalized * maxIndex);
    if (pitch.note === step.note && pitch.octave === step.octave) return;
    dispatch({ type: 'pattern/setStep', index, patch: pitch });
  }
</script>

<div class="cell" class:active class:rest={step.rest} class:held={held && !step.rest}>
  <div
    class="pitch"
    role="slider"
    tabindex="0"
    aria-label={`Hauteur du pas ${index + 1}`}
    aria-valuemin="0"
    aria-valuemax={maxIndex}
    aria-valuenow={pitchToIndex(step)}
    aria-valuetext={label}
    use:knobDrag={{
      getValue: () => pitchToIndex(step) / maxIndex,
      onchange: setPitch,
      ondefault: () => setPitch(defaultPitch),
    }}
  >
    {label}
  </div>
  <div class="flags">
    <button
      type="button"
      class="flag gate"
      class:on={!step.rest}
      aria-pressed={!step.rest}
      aria-label={`Pas ${index + 1} ${step.rest ? 'silencieux' : 'joué'}`}
      onclick={() => dispatch({ type: 'pattern/toggleStepFlag', index, flag: 'rest' })}
    ></button>
    <button
      type="button"
      class="flag"
      class:on={step.accent}
      aria-pressed={step.accent}
      aria-label={`Accent du pas ${index + 1}`}
      onclick={() => dispatch({ type: 'pattern/toggleStepFlag', index, flag: 'accent' })}
    >
      A
    </button>
    <button
      type="button"
      class="flag"
      class:on={step.slide}
      aria-pressed={step.slide}
      aria-label={`Slide du pas ${index + 1}`}
      onclick={() => dispatch({ type: 'pattern/toggleStepFlag', index, flag: 'slide' })}
    >
      S
    </button>
  </div>
</div>

<style>
  .cell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--step-gap);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--step-cell-bg);
    transition: box-shadow var(--duration-fast) var(--easing);
  }

  .cell.active {
    box-shadow: var(--step-active-ring);
  }

  .cell.rest .pitch {
    color: var(--color-text-muted);
  }

  .cell.held .pitch {
    color: var(--step-held-color);
  }

  .cell.held .pitch::before {
    content: '~';
  }

  .pitch {
    min-height: var(--control-size);
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    cursor: ns-resize;
    user-select: none;
    outline: none;
  }

  .pitch:focus-visible {
    box-shadow: var(--focus-ring);
  }

  .flags {
    display: flex;
    flex-direction: column;
    gap: var(--step-gap);
  }

  .flag {
    min-height: var(--space-5);
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--step-flag-off);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    line-height: 1;
    cursor: pointer;
  }

  .flag.gate {
    min-height: var(--space-3);
  }

  .flag.on {
    color: var(--color-accent-contrast);
  }

  .flag.on {
    background: var(--step-flag-on);
  }

  .flag:focus-visible {
    box-shadow: var(--focus-ring);
  }
</style>
