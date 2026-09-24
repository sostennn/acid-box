<script lang="ts">
  import {
    DRUM_DEFAULT_VELOCITY,
    DRUM_VOICES,
    type Command,
    type DrumPattern,
    type DrumVoiceId,
    type StepIndex,
  } from '@engine';
  import { toPercent } from '../format';
  import { knobDrag } from '../gestures/knob-drag';
  import { DRUM_LABELS } from './drum-labels';
  import PlayheadStrip from './PlayheadStrip.svelte';

  interface Props {
    pattern: DrumPattern;
    activeStep: StepIndex | null;
    dispatch: (command: Command) => void;
  }

  const { pattern, activeStep, dispatch }: Props = $props();

  const setVelocity = (voice: DrumVoiceId, index: StepIndex, velocity: number) =>
    dispatch({ type: 'pattern/setDrumVelocity', voice, index, velocity });

  const toggle = (voice: DrumVoiceId, index: StepIndex, velocity: number) =>
    setVelocity(voice, index, velocity > 0 ? 0 : DRUM_DEFAULT_VELOCITY);

  // Entrée seulement : l'espace reste le raccourci play / stop, même quand une
  // case a pris le focus au clic.
  const onKeydown = (voice: DrumVoiceId, index: StepIndex) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.repeat) return;
    event.preventDefault();
    toggle(voice, index, pattern[voice][index]);
  };
</script>

<div class="drums">
  <span></span>
  <PlayheadStrip step={activeStep} />
  {#each DRUM_VOICES as voice (voice)}
    <span class="name">{DRUM_LABELS[voice]}</span>
    <div class="row" role="group" aria-label={DRUM_LABELS[voice]}>
      {#each pattern[voice] as velocity, i (i)}
        {@const index = i as StepIndex}
        <div
          class="cell"
          class:on={velocity > 0}
          class:beat={index % 4 === 0}
          class:active={index === activeStep}
          style:--velocity={velocity}
          role="slider"
          tabindex="0"
          aria-label={`${DRUM_LABELS[voice]}, pas ${index + 1}`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={toPercent(velocity)}
          aria-valuetext={velocity > 0 ? `vélocité ${toPercent(velocity)} %` : 'inactif'}
          onkeydown={onKeydown(voice, index)}
          use:knobDrag={{
            getValue: () => velocity,
            onchange: (value) => setVelocity(voice, index, value),
            ontap: (startValue) => toggle(voice, index, startValue),
          }}
        >
          <span class="fill" aria-hidden="true"></span>
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .drums {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    gap: var(--step-gap) var(--space-3);
  }

  .name {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: var(--step-gap);
  }

  .cell {
    position: relative;
    min-height: var(--control-size);
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--drum-cell-bg);
    cursor: ns-resize;
    user-select: none;
    outline: none;
  }

  .cell.beat {
    background: var(--drum-cell-beat);
  }

  .cell.active {
    box-shadow: var(--step-active-ring);
  }

  .cell:focus-visible {
    box-shadow: var(--focus-ring);
  }

  .fill {
    position: absolute;
    inset: auto 0 0;
    height: calc(var(--velocity) * 100%);
    background: var(--drum-cell-on);
  }
</style>
