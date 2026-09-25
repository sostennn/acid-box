/**
 * Cycle de vie commun des frappes : un nœud source neuf par frappe, démarré à
 * son temps, arrêté à la fin de sa queue, débranché à `ended`. Un nœud source
 * ne se redémarre jamais.
 */
import type { AudioContextLike } from '../../audio/context';
import { DRUM_CUT_TAU_S, DRUM_TAIL_TAUS } from '../../model/constants';
import type { DrumHitSpec } from './drum-plan';

export interface DrumHit {
  /** Coupe la frappe sans clic à `time` ; si elle n'a pas encore démarré, elle ne sonnera pas. */
  cut(time: number): void;
}

export interface HitTarget {
  readonly ctx: AudioContextLike;
  readonly output: AudioNode;
  /** Bruit blanc partagé par toutes les frappes, généré une fois. */
  readonly noise: AudioBuffer;
  /** Appelé quand la source a fini de sonner et que ses nœuds sont débranchés. */
  readonly onEnded: (hit: DrumHit) => void;
}

export type DrumPlayer = (target: HitTarget, spec: DrumHitSpec, time: number) => DrumHit;

export interface HitNodes {
  readonly source: AudioScheduledSourceNode;
  /** Gain d'enveloppe, le dernier nœud avant la sortie. */
  readonly vca: GainNode;
  /** Tous les nœuds de la frappe, source et vca compris. */
  readonly nodes: readonly AudioNode[];
  readonly time: number;
  /** Fin de la queue : l'enveloppe est inaudible au-delà. */
  readonly end: number;
}

export function startHit(target: HitTarget, { source, vca, nodes, time, end }: HitNodes): DrumHit {
  const hit: DrumHit = {
    cut(at) {
      if (at <= time) {
        // Arrêtée avant son départ, une source ne produit rien.
        source.stop(at);
        return;
      }
      vca.gain.cancelScheduledValues(at);
      vca.gain.setTargetAtTime(0, at, DRUM_CUT_TAU_S);
      source.stop(Math.min(end, at + DRUM_TAIL_TAUS * DRUM_CUT_TAU_S));
    },
  };

  source.addEventListener('ended', () => {
    nodes.forEach((node) => node.disconnect());
    target.onEnded(hit);
  });
  vca.connect(target.output);
  source.start(time);
  source.stop(end);
  return hit;
}
