/**
 * Plan d'automation d'un pas de la voix basse : fonction pure qui décrit,
 * sous forme de données, ce que la voix doit programmer sur ses AudioParam.
 * C'est ce qui rend les sémantiques (gate, enveloppe, et bientôt accent et
 * slide) testables sans Web Audio.
 *
 * Toutes les enveloppes utilisent `setTargetAtTime` : la courbe part de la
 * valeur courante du paramètre, quel qu'il soit, donc jamais de clic ni de
 * problème de rampe exponentielle depuis zéro.
 */
import { GATE_RATIO, MIN_GAIN, VCA_ATTACK_TAU_S, VCA_RELEASE_TAU_S } from '../../model/constants';
import { decayToSeconds, envModToCents } from '../../model/mapping';
import { midiToFrequency, pitchToMidi } from '../../model/pitch';
import type { BassParams, Step } from '../../model/types';

export type ParamTarget = 'frequency' | 'filterDetune' | 'vca';

export type ParamEvent =
  | { readonly target: ParamTarget; readonly kind: 'cancel'; readonly time: number }
  | {
      readonly target: ParamTarget;
      readonly kind: 'set';
      readonly time: number;
      readonly value: number;
    }
  | {
      readonly target: ParamTarget;
      readonly kind: 'expRamp';
      readonly time: number;
      readonly value: number;
    }
  | {
      readonly target: ParamTarget;
      readonly kind: 'target';
      readonly time: number;
      readonly value: number;
      readonly timeConstant: number;
    };

export interface StepPlanInput {
  readonly step: Step;
  readonly params: BassParams;
  /** Temps audio du pas, shuffle inclus. */
  readonly time: number;
  readonly stepDuration: number;
}

export function planStep({ step, params, time, stepDuration }: StepPlanInput): ParamEvent[] {
  // Un silence ne programme rien : le relâchement du pas précédent fait le travail.
  if (step.rest) return [];

  const gateEnd = time + stepDuration * GATE_RATIO;

  return [
    { target: 'frequency', kind: 'cancel', time },
    { target: 'frequency', kind: 'set', time, value: midiToFrequency(pitchToMidi(step)) },

    { target: 'filterDetune', kind: 'cancel', time },
    { target: 'filterDetune', kind: 'set', time, value: envModToCents(params.envMod) },
    {
      target: 'filterDetune',
      kind: 'target',
      time,
      value: 0,
      timeConstant: decayToSeconds(params.decay),
    },

    { target: 'vca', kind: 'cancel', time },
    { target: 'vca', kind: 'target', time, value: 1, timeConstant: VCA_ATTACK_TAU_S },
    {
      target: 'vca',
      kind: 'target',
      time: gateEnd,
      value: MIN_GAIN,
      timeConstant: VCA_RELEASE_TAU_S,
    },
  ];
}
