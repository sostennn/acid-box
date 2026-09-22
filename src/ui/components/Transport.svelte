<script lang="ts">
  import { BPM_MAX, BPM_MIN, type Command, type MixParams, type TransportState } from '@engine';
  import Knob from './Knob.svelte';

  interface Props {
    transport: TransportState;
    mix: MixParams;
    dispatch: (command: Command) => void;
  }

  const { transport, mix, dispatch }: Props = $props();
  const playing = $derived(transport.status === 'playing');

  const bpmToNormalized = (bpm: number) => (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN);
  const normalizedToBpm = (value: number) => Math.round(BPM_MIN + value * (BPM_MAX - BPM_MIN));

  function toggle() {
    dispatch({ type: playing ? 'transport/stop' : 'transport/play' });
  }
</script>

<div class="transport">
  <button
    type="button"
    class="play"
    class:playing
    aria-pressed={playing}
    aria-label={playing ? 'Arrêter' : 'Lire'}
    onclick={toggle}
  >
    {playing ? '■' : '▶'}
  </button>

  <Knob
    label="Tempo"
    value={bpmToNormalized(transport.bpm)}
    defaultValue={bpmToNormalized(125)}
    format={(value) => `${normalizedToBpm(value)} BPM`}
    onchange={(value) => dispatch({ type: 'transport/setBpm', bpm: normalizedToBpm(value) })}
  />

  <Knob
    label="Shuffle"
    value={transport.shuffle}
    onchange={(value) => dispatch({ type: 'transport/setShuffle', value })}
  />

  <Knob
    label="Master"
    value={mix.masterLevel}
    defaultValue={0.8}
    onchange={(value) => dispatch({ type: 'mix/set', patch: { masterLevel: value } })}
  />
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .play {
    width: var(--control-size);
    height: var(--control-size);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-round);
    background: var(--color-surface-raised);
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--easing),
      color var(--duration-fast) var(--easing);
  }

  .play.playing {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent);
  }
</style>
