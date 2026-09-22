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
    dispatch: (command: Command) => void;
  }

  const { index, step, active, dispatch }: Props = $props();

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

<div class="cell" class:active class:rest={step.rest}>
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
  <button
    type="button"
    class="flag"
    class:on={!step.rest}
    aria-pressed={!step.rest}
    aria-label={`Pas ${index + 1} ${step.rest ? 'silencieux' : 'joué'}`}
    onclick={() => dispatch({ type: 'pattern/toggleStepFlag', index, flag: 'rest' })}
  ></button>
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

  .flag {
    height: var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--step-flag-off);
    cursor: pointer;
  }

  .flag.on {
    background: var(--step-flag-on);
  }

  .flag:focus-visible {
    box-shadow: var(--focus-ring);
  }
</style>
