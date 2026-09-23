/**
 * Plan d'automation d'un pas de la voix basse : fonction pure qui décrit,
 * sous forme de données, ce que la voix doit programmer sur ses AudioParam.
 * C'est ce qui rend les sémantiques (gate, enveloppe, accent, slide)
 * testables sans Web Audio.
 *
 * Les enveloppes utilisent `setTargetAtTime` : la courbe part de la valeur
 * courante du paramètre, quel qu'il soit, donc jamais de clic ni de problème
 * de rampe exponentielle depuis zéro.
 */
import {
  ACCENT_ENV_DECAY_S,
  ACCENT_MAX_GAIN_BOOST,
  ACCENT_MAX_OCTAVES,
  ACCENT_Q_ATTACK_TAU_S,
  ACCENT_Q_HOLD_S,
  GATE_RATIO,
  MIN_GAIN,
  SLIDE_TAU_S,
  VCA_ATTACK_TAU_S,
  VCA_RELEASE_TAU_S,
} from '../../model/constants';
import { accentedQ, decayToSeconds, envModToCents, resonanceToQ } from '../../model/mapping';
import { midiToFrequency, pitchToMidi } from '../../model/pitch';
import type { BassParams, Step } from '../../model/types';

export type ParamTarget = 'frequency' | 'filterDetune' | 'filterQ' | 'vca';

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
      readonly kind: 'target';
      readonly time: number;
      readonly value: number;
      readonly timeConstant: number;
    };

export interface StepPlanInput {
  readonly step: Step;
  /** Une note sonne encore : le dernier pas joué portait un slide et n'a pas été coupé. */
  readonly held: boolean;
  readonly params: BassParams;
  /** Temps audio du pas, shuffle inclus. */
  readonly time: number;
  readonly stepDuration: number;
}

export function planStep({ step, held, params, time, stepDuration }: StepPlanInput): ParamEvent[] {
  // Un silence ne programme rien : le pas joué précédent a déjà programmé sa
  // fermeture, ou tient volontairement la note s'il porte un slide.
  if (step.rest) return [];

  const events: ParamEvent[] = [];
  const frequency = midiToFrequency(pitchToMidi(step));

  if (held) {
    // Pas d'arrivée d'un slide : la note glisse depuis la hauteur qui sonne,
    // rien n'est redéclenché. Posé à `time`, le glissé ne peut pas être effacé
    // par le `cancel` du pas suivant, même quand le shuffle raccourcit le créneau.
    events.push(
      { target: 'frequency', kind: 'cancel', time },
      { target: 'frequency', kind: 'target', time, value: frequency, timeConstant: SLIDE_TAU_S },
    );
  } else {
    const accent = step.accent ? params.accent : 0;
    const envDecay = step.accent ? ACCENT_ENV_DECAY_S : decayToSeconds(params.decay);

    events.push(
      { target: 'frequency', kind: 'cancel', time },
      { target: 'frequency', kind: 'set', time, value: frequency },

      { target: 'filterDetune', kind: 'cancel', time },
      {
        target: 'filterDetune',
        kind: 'set',
        time,
        value: envModToCents(params.envMod) + accent * ACCENT_MAX_OCTAVES * 1200,
      },
      { target: 'filterDetune', kind: 'target', time, value: 0, timeConstant: envDecay },

      { target: 'vca', kind: 'cancel', time },
      {
        target: 'vca',
        kind: 'target',
        time,
        value: 1 + accent * ACCENT_MAX_GAIN_BOOST,
        timeConstant: VCA_ATTACK_TAU_S,
      },
    );

    if (step.accent) {
      // Les pas sans accent ne touchent pas à Q : le knob garde la main. Un
      // pas accentué se ré-ancre sur la valeur courante du knob.
      events.push(
        { target: 'filterQ', kind: 'cancel', time },
        {
          target: 'filterQ',
          kind: 'target',
          time,
          value: accentedQ(params.resonance, accent),
          timeConstant: ACCENT_Q_ATTACK_TAU_S,
        },
        {
          target: 'filterQ',
          kind: 'target',
          time: time + ACCENT_Q_HOLD_S,
          value: resonanceToQ(params.resonance),
          timeConstant: envDecay,
        },
      );
    }
  }

  // Un pas qui slide laisse la note ouverte : c'est le pas d'arrivée qui fermera.
  if (!step.slide) {
    events.push({
      target: 'vca',
      kind: 'target',
      time: time + stepDuration * GATE_RATIO,
      value: MIN_GAIN,
      timeConstant: VCA_RELEASE_TAU_S,
    });
  }

  return events;
}
