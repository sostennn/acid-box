/**
 * Tête de lecture visuelle : une boucle d'animation, active seulement en
 * lecture, demande au moteur quel pas est audible à l'instant présent.
 * Elle n'est jamais pilotée par le scheduler, qui travaille dans le futur.
 */
import type { StepIndex } from '@engine';
import type { EngineStore } from '../state/engine.svelte';

export interface Playhead {
  readonly step: StepIndex | null;
}

/** À appeler pendant l'initialisation d'un composant (utilise `$effect`). */
export function createPlayhead(store: EngineStore): Playhead {
  let step = $state<StepIndex | null>(null);

  $effect(() => {
    if (store.state.transport.status !== 'playing') {
      step = null;
      return;
    }
    let frame = requestAnimationFrame(function loop() {
      const next = store.audibleStep();
      if (next !== step) step = next;
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  });

  return {
    get step() {
      return step;
    },
  };
}
