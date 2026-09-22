/**
 * Étage de filtre de la voix basse. L'interface isole le reste du moteur de
 * l'implémentation : biquad natif en v1, filtre en échelle en AudioWorklet en v2.
 *
 * Deux paramètres de fréquence volontairement séparés : `frequency` reçoit le
 * knob cutoff, `detune` (en cents) reçoit l'enveloppe. La fréquence effective
 * vaut `frequency × 2^(detune / 1200)` : l'enveloppe est exponentielle, donc
 * musicale, et un knob tourné en lecture n'entre jamais en conflit avec les
 * événements déjà programmés.
 */
import type { AudioContextLike } from '../audio/context';

export interface FilterStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  readonly frequency: AudioParam;
  readonly detune: AudioParam;
  readonly q: AudioParam;
  dispose(): void;
}

export function createBiquadFilterStage(ctx: AudioContextLike): FilterStage {
  const node = ctx.createBiquadFilter();
  node.type = 'lowpass';
  return {
    input: node,
    output: node,
    frequency: node.frequency,
    detune: node.detune,
    q: node.Q,
    dispose: () => node.disconnect(),
  };
}
