/**
 * Graphe de sortie : les voix se connectent aux bus, jamais directement à la
 * destination. Bus basse → sidechain → master ; bus rythmique → master.
 */
import type { AudioContextLike } from '../audio/context';
import { smoothSet } from '../audio/params';
import { levelToGain } from '../model/mapping';
import type { MixParams } from '../model/types';
import { createSidechain, type Sidechain } from './sidechain';

export interface AudioGraph {
  readonly master: GainNode;
  /** Point d'entrée de la voix basse, au niveau de mix de la basse. */
  readonly bass: GainNode;
  /** Point d'entrée de la boîte à rythmes. */
  readonly drums: GainNode;
  /** Ducking de la basse, en aval de son niveau de mix. */
  readonly sidechain: Sidechain;
  applyMix(mix: MixParams): void;
  dispose(): void;
}

export function createAudioGraph(ctx: AudioContextLike, mix: MixParams): AudioGraph {
  const master = ctx.createGain();
  master.gain.value = levelToGain(mix.masterLevel);
  master.connect(ctx.destination);

  const bass = ctx.createGain();
  bass.gain.value = levelToGain(mix.bassLevel);
  const sidechain = createSidechain(ctx);
  bass.connect(sidechain.node);
  sidechain.node.connect(master);

  const drums = ctx.createGain();
  drums.gain.value = levelToGain(mix.drumsLevel);
  drums.connect(master);

  return {
    master,
    bass,
    drums,
    sidechain,
    applyMix(next) {
      smoothSet(master.gain, levelToGain(next.masterLevel), ctx);
      smoothSet(bass.gain, levelToGain(next.bassLevel), ctx);
      smoothSet(drums.gain, levelToGain(next.drumsLevel), ctx);
    },
    dispose() {
      bass.disconnect();
      drums.disconnect();
      sidechain.dispose();
      master.disconnect();
    },
  };
}
