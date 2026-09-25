<script lang="ts">
  import { onDestroy } from 'svelte';
  import AudioGate from './components/AudioGate.svelte';
  import BassPanel from './components/BassPanel.svelte';
  import BassSequencer from './components/BassSequencer.svelte';
  import DrumGrid from './components/DrumGrid.svelte';
  import DrumPanel from './components/DrumPanel.svelte';
  import Transport from './components/Transport.svelte';
  import { createPlayhead } from './playhead/playhead.svelte';
  import { createEngineStore } from './state/engine.svelte';

  const engine = createEngineStore();
  const playhead = createPlayhead(engine);
  onDestroy(() => engine.dispose());

  function onKeydown(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.repeat) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('button, input, select, textarea, [role="slider"]')
    ) {
      return;
    }
    event.preventDefault();
    engine.dispatch({
      type: engine.state.transport.status === 'playing' ? 'transport/stop' : 'transport/play',
    });
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if engine.state.audio.availability !== 'running'}
  <AudioGate availability={engine.state.audio.availability} onunlock={() => engine.unlock()} />
{:else}
  <main class="app">
    <header class="header">
      <h1 class="brand">acid-box</h1>
      <p class="status">
        audio actif · {engine.state.audio.sampleRate} Hz · latence
        {Math.round(engine.state.audio.outputLatency * 1000)} ms
      </p>
    </header>

    <section class="panel">
      <Transport
        transport={engine.state.transport}
        mix={engine.state.mix}
        dispatch={engine.dispatch}
      />
    </section>

    <section class="panel">
      <BassPanel bass={engine.state.bass} dispatch={engine.dispatch} />
    </section>

    <section class="panel">
      <BassSequencer
        pattern={engine.state.pattern.bass}
        activeStep={playhead.step}
        dispatch={engine.dispatch}
      />
    </section>

    <section class="panel drums">
      <DrumPanel
        drums={engine.state.drums}
        appliedMutes={engine.state.appliedMutes}
        dispatch={engine.dispatch}
      />
      <DrumGrid
        pattern={engine.state.pattern.drums}
        activeStep={playhead.step}
        dispatch={engine.dispatch}
      />
    </section>
  </main>
{/if}

<style>
  .app {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .brand {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.04em;
  }

  .status {
    margin: 0;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }

  .panel {
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  .drums {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
