<script lang="ts">
  import {
    cutoffToHz,
    decayToSeconds,
    resonanceToQ,
    tuningToCents,
    type BassKnobId,
    type BassParams,
    type Command,
  } from '@engine';
  import Knob from './Knob.svelte';

  interface Props {
    bass: BassParams;
    dispatch: (command: Command) => void;
  }

  const { bass, dispatch }: Props = $props();

  const set = (knob: BassKnobId) => (value: number) =>
    dispatch({ type: 'bass/setKnob', knob, value });

  const percent = (value: number) => `${Math.round(value * 100)} %`;
  const hertz = (value: number) => {
    const hz = cutoffToHz(value);
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
  };
  const seconds = (value: number) => {
    const s = decayToSeconds(value);
    return s >= 1 ? `${s.toFixed(2)} s` : `${Math.round(s * 1000)} ms`;
  };
  const semitones = (value: number) => {
    const st = tuningToCents(value) / 100;
    return `${st > 0 ? '+' : ''}${st.toFixed(1)} st`;
  };
</script>

<div class="panel">
  <div class="waveform" role="group" aria-label="Forme d'onde">
    {#each ['sawtooth', 'square'] as const as waveform (waveform)}
      <button
        type="button"
        class="wave"
        class:on={bass.waveform === waveform}
        aria-pressed={bass.waveform === waveform}
        onclick={() => dispatch({ type: 'bass/setWaveform', waveform })}
      >
        {waveform === 'sawtooth' ? 'Saw' : 'Square'}
      </button>
    {/each}
  </div>

  <div class="knobs">
    <Knob
      label="Tuning"
      value={bass.tuning}
      defaultValue={0.5}
      bipolar
      format={semitones}
      onchange={set('tuning')}
    />
    <Knob
      label="Cutoff"
      value={bass.cutoff}
      defaultValue={0.4}
      format={hertz}
      onchange={set('cutoff')}
    />
    <Knob
      label="Reso"
      value={bass.resonance}
      defaultValue={0.6}
      format={(v) => `Q ${resonanceToQ(v).toFixed(1)}`}
      onchange={set('resonance')}
    />
    <Knob
      label="Env mod"
      value={bass.envMod}
      defaultValue={0.5}
      format={percent}
      onchange={set('envMod')}
    />
    <Knob
      label="Decay"
      value={bass.decay}
      defaultValue={0.4}
      format={seconds}
      onchange={set('decay')}
    />
    <Knob
      label="Accent"
      value={bass.accent}
      defaultValue={0.6}
      format={percent}
      onchange={set('accent')}
    />
    <Knob
      label="Drive"
      value={bass.drive}
      defaultValue={0.2}
      format={percent}
      onchange={set('drive')}
    />
  </div>
</div>

<style>
  .panel {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .waveform {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .wave {
    min-width: 5em;
    min-height: var(--control-size);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    cursor: pointer;
  }

  .wave.on {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent);
  }

  .knobs {
    display: flex;
    gap: var(--space-5);
    flex-wrap: wrap;
  }
</style>
