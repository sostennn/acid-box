/**
 * Graphe de sortie : les voix se connectent aux bus, jamais directement à la
 * destination. Pour l'instant un seul bus master ; les bus basse et
 * rythmique arrivent avec leurs voix.
 */
import type { AudioContextLike } from '../audio/context';
import { smoothSet } from '../audio/params';
import { levelToGain } from '../model/mapping';
import type { MixParams } from '../model/types';

export interface AudioGraph {
  /** Point d'entrée des voix. */
  readonly master: GainNode;
  applyMix(mix: MixParams): void;
  dispose(): void;
}

export function createAudioGraph(ctx: AudioContextLike, mix: MixParams): AudioGraph {
  const master = ctx.createGain();
  master.gain.value = levelToGain(mix.masterLevel);
  master.connect(ctx.destination);

  return {
    master,
    applyMix(next) {
      smoothSet(master.gain, levelToGain(next.masterLevel), ctx);
    },
    dispose() {
      master.disconnect();
    },
  };
}
