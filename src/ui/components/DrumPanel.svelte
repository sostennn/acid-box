<script lang="ts">
  import {
    DEFAULT_DRUMS,
    DRUM_VOICES,
    type Command,
    type DrumMutes,
    type DrumParams,
  } from '@engine';
  import { DRUM_LABELS } from './drum-labels';
  import Knob from './Knob.svelte';
  import Switch from './Switch.svelte';
  import { formatPercent } from '../format';

  interface Props {
    drums: DrumParams;
    /** Mutes entendus : un écart avec `drums` attend la mesure suivante. */
    appliedMutes: DrumMutes;
    dispatch: (command: Command) => void;
  }

  const { drums, appliedMutes, dispatch }: Props = $props();
</script>

<div class="panel">
  {#each DRUM_VOICES as voice (voice)}
    <div class="strip" role="group" aria-label={DRUM_LABELS[voice]}>
      <span class="name">{DRUM_LABELS[voice]}</span>
      <Knob
        label="Niveau"
        value={drums[voice].level}
        defaultValue={DEFAULT_DRUMS[voice].level}
        format={formatPercent}
        onchange={(value) => dispatch({ type: 'drums/setLevel', voice, value })}
      />
      <Switch
        label="Mute"
        checked={drums[voice].muted}
        pending={drums[voice].muted !== appliedMutes[voice]}
        onchange={(muted) => dispatch({ type: 'drums/setMuted', voice, muted })}
      />
    </div>
  {/each}
</div>

<style>
  .panel {
    display: flex;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
  }
</style>
