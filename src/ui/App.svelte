<script lang="ts">
  import { onDestroy } from 'svelte';
  import AudioGate from './components/AudioGate.svelte';
  import { createEngineStore } from './state/engine.svelte';

  const engine = createEngineStore();
  onDestroy(() => engine.dispose());

  async function unlock() {
    await engine.unlock();
    engine.playTestTone();
  }
</script>

{#if engine.state.audio.availability !== 'running'}
  <AudioGate availability={engine.state.audio.availability} onunlock={unlock} />
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
      <p>Lot 0 : la chaîne audio fonctionne. Le séquenceur arrive au lot suivant.</p>
      <button type="button" class="tone" onclick={() => engine.playTestTone()}>Son de test</button>
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  .panel p {
    margin: 0;
  }

  .tone {
    min-height: var(--control-size);
    padding: var(--space-2) var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    cursor: pointer;
  }

  .tone:hover {
    border-color: var(--color-accent);
  }
</style>
