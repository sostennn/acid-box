/**
 * Graphe de sortie : les voix se connectent aux bus, jamais directement à la
 * destination. Bus basse → master ; le bus rythmique arrive avec ses voix.
 */
import type { AudioContextLike } from '../audio/context';
import { smoothSet } from '../audio/params';
import { levelToGain } from '../model/mapping';
import type { MixParams } from '../model/types';

export interface AudioGraph {
  readonly master: GainNode;
  /** Point d'entrée de la voix basse (le sidechain s'insérera ici au lot 5). */
  readonly bass: GainNode;
  applyMix(mix: MixParams): void;
  dispose(): void;
}

export function createAudioGraph(ctx: AudioContextLike, mix: MixParams): AudioGraph {
  const master = ctx.createGain();
  master.gain.value = levelToGain(mix.masterLevel);
  master.connect(ctx.destination);

  const bass = ctx.createGain();
  bass.gain.value = levelToGain(mix.bassLevel);
  bass.connect(master);

  return {
    master,
    bass,
    applyMix(next) {
      smoothSet(master.gain, levelToGain(next.masterLevel), ctx);
      smoothSet(bass.gain, levelToGain(next.bassLevel), ctx);
    },
    dispose() {
      bass.disconnect();
      master.disconnect();
    },
  };
}
