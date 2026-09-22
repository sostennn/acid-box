<script lang="ts">
  import { BPM_MAX, BPM_MIN, type Command, type TransportState } from '@engine';

  interface Props {
    transport: TransportState;
    dispatch: (command: Command) => void;
  }

  const { transport, dispatch }: Props = $props();
  const playing = $derived(transport.status === 'playing');

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

  <!-- Curseurs provisoires : remplacés par des knobs au lot 2. -->
  <label class="field">
    <span class="name">Tempo</span>
    <input
      type="range"
      min={BPM_MIN}
      max={BPM_MAX}
      step="1"
      value={transport.bpm}
      oninput={(event) =>
        dispatch({ type: 'transport/setBpm', bpm: Number(event.currentTarget.value) })}
    />
    <output class="value">{transport.bpm} BPM</output>
  </label>

  <label class="field">
    <span class="name">Shuffle</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={transport.shuffle}
      oninput={(event) =>
        dispatch({ type: 'transport/setShuffle', value: Number(event.currentTarget.value) })}
    />
    <output class="value">{Math.round(transport.shuffle * 100)} %</output>
  </label>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: var(--space-5);
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

  .field {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-3);
  }

  .name {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .value {
    min-width: 5em;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    text-align: right;
  }

  input[type='range'] {
    width: 160px;
    accent-color: var(--color-accent);
  }
</style>
