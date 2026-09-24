<script lang="ts">
  import {
    BPM_MAX,
    BPM_MIN,
    DEFAULT_MIX,
    DEFAULT_TRANSPORT,
    type Command,
    type MixParams,
    type TransportState,
  } from '@engine';
  import Knob from './Knob.svelte';
  import Switch from './Switch.svelte';
  import { formatPercent } from '../format';

  interface Props {
    transport: TransportState;
    mix: MixParams;
    dispatch: (command: Command) => void;
  }

  const { transport, mix, dispatch }: Props = $props();
  const playing = $derived(transport.status === 'playing');

  const bpmToNormalized = (bpm: number) => (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN);
  const normalizedToBpm = (value: number) => Math.round(BPM_MIN + value * (BPM_MAX - BPM_MIN));

  const setMix = (key: keyof MixParams) => (value: number) =>
    dispatch({ type: 'mix/set', patch: { [key]: value } });

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
    defaultValue={bpmToNormalized(DEFAULT_TRANSPORT.bpm)}
    format={(value) => `${normalizedToBpm(value)} BPM`}
    onchange={(value) => dispatch({ type: 'transport/setBpm', bpm: normalizedToBpm(value) })}
  />

  <Knob
    label="Shuffle"
    value={transport.shuffle}
    onchange={(value) => dispatch({ type: 'transport/setShuffle', value })}
  />

  <div class="group" role="group" aria-label="Sidechain">
    <Switch
      label="Sidechain"
      checked={transport.sidechain.enabled}
      onchange={(enabled) => dispatch({ type: 'transport/setSidechain', patch: { enabled } })}
    />
    <Knob
      label="Amount"
      value={transport.sidechain.amount}
      defaultValue={DEFAULT_TRANSPORT.sidechain.amount}
      format={formatPercent}
      onchange={(amount) => dispatch({ type: 'transport/setSidechain', patch: { amount } })}
    />
  </div>

  <div class="group" role="group" aria-label="Mix">
    <Knob
      label="Basse"
      value={mix.bassLevel}
      defaultValue={DEFAULT_MIX.bassLevel}
      format={formatPercent}
      onchange={setMix('bassLevel')}
    />
    <Knob
      label="Rythmique"
      value={mix.drumsLevel}
      defaultValue={DEFAULT_MIX.drumsLevel}
      format={formatPercent}
      onchange={setMix('drumsLevel')}
    />
    <Knob
      label="Master"
      value={mix.masterLevel}
      defaultValue={DEFAULT_MIX.masterLevel}
      format={formatPercent}
      onchange={setMix('masterLevel')}
    />
  </div>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .group {
    display: flex;
    align-items: center;
    gap: var(--space-5);
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
