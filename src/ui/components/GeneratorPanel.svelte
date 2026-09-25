<script lang="ts">
  import {
    DEFAULT_GENERATOR,
    NOTE_NAMES,
    SCALE_IDS,
    type Command,
    type GeneratorParams,
    type PitchClass,
    type ScaleId,
  } from '@engine';
  import Knob from './Knob.svelte';
  import { formatPercent } from '../format';

  interface Props {
    generator: GeneratorParams;
    /** Vrai tant que la dernière ligne générée peut être annulée. */
    canUndo: boolean;
    dispatch: (command: Command) => void;
  }

  const { generator, canUndo, dispatch }: Props = $props();

  const SCALE_LABELS: Readonly<Record<ScaleId, string>> = {
    minor: 'Mineure',
    phrygian: 'Phrygienne',
  };

  type DensityKey = 'noteDensity' | 'accentDensity' | 'slideDensity' | 'octaveJumpDensity';

  const DENSITIES: readonly { key: DensityKey; label: string }[] = [
    { key: 'noteDensity', label: 'Notes' },
    { key: 'accentDensity', label: 'Accents' },
    { key: 'slideDensity', label: 'Slides' },
    { key: 'octaveJumpDensity', label: 'Octaves' },
  ];

  const setParams = (patch: Partial<GeneratorParams>) =>
    dispatch({ type: 'generator/setParams', patch });

  function onRootChange(event: Event & { currentTarget: HTMLSelectElement }) {
    // Les options ne portent que des classes de hauteur ; le reducer borne de toute façon.
    setParams({ root: Number(event.currentTarget.value) as PitchClass });
  }
</script>

<div class="panel">
  <div class="scale" role="group" aria-label="Gamme">
    {#each SCALE_IDS as scale (scale)}
      <button
        type="button"
        class="option"
        class:on={generator.scale === scale}
        aria-pressed={generator.scale === scale}
        onclick={() => setParams({ scale })}
      >
        {SCALE_LABELS[scale]}
      </button>
    {/each}
  </div>

  <label class="root">
    <span class="label">Tonique</span>
    <select class="select" value={generator.root} onchange={onRootChange}>
      {#each NOTE_NAMES as name, note (note)}
        <option value={note}>{name}</option>
      {/each}
    </select>
  </label>

  <div class="knobs" role="group" aria-label="Densités">
    {#each DENSITIES as { key, label } (key)}
      <Knob
        {label}
        value={generator[key]}
        defaultValue={DEFAULT_GENERATOR[key]}
        format={formatPercent}
        onchange={(value) => setParams({ [key]: value })}
      />
    {/each}
  </div>

  <div class="actions">
    <button
      type="button"
      class="action primary"
      onclick={() => dispatch({ type: 'generator/run' })}
    >
      Générer
    </button>
    <button
      type="button"
      class="action"
      disabled={!canUndo}
      onclick={() => dispatch({ type: 'generator/undo' })}
    >
      Annuler
    </button>
  </div>
</div>

<style>
  .panel {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .scale,
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .option,
  .action {
    min-width: 7em;
    min-height: var(--control-size);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    cursor: pointer;
  }

  .option.on,
  .action.primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent);
  }

  .action:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .root {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .select {
    min-width: 5em;
    min-height: var(--control-size);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .knobs {
    display: flex;
    gap: var(--space-5);
    flex-wrap: wrap;
  }
</style>
