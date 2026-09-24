/**
 * Voix basse monophonique : un oscillateur persistant, un étage de filtre, un
 * VCA et l'overdrive. Applique les plans d'automation de bass-plan.ts et les
 * knobs, sans décider de rien elle-même.
 */
import type { AudioContextLike } from '../../audio/context';
import { applyAutomation, safeTime, smoothSet } from '../../audio/params';
import { KNOB_SMOOTHING_S, MIN_GAIN, STOP_RELEASE_TAU_S } from '../../model/constants';
import { cutoffToHz, resonanceToQ, tuningToCents } from '../../model/mapping';
import type { BassParams } from '../../model/types';
import type { FilterStage } from '../filter-stage';
import { planStep, type ParamEvent, type ParamTarget, type StepPlanInput } from './bass-plan';
import { createDrive } from './drive';

/** Un pas à jouer ; la voix sait elle-même si une note sonne encore. */
export type StepTrigger = Omit<StepPlanInput, 'held'>;

export interface BassVoice {
  trigger(input: StepTrigger): void;
  /** Knobs : écriture lissée, indépendante des événements programmés. */
  applyParams(params: BassParams): void;
  /** Coupe la note en cours sans clic et annule tout ce qui était programmé après `time`. */
  release(time: number): void;
  dispose(): void;
}

export function createBassVoice(
  ctx: AudioContextLike,
  filter: FilterStage,
  output: AudioNode,
  initial: BassParams,
): BassVoice {
  const oscillator = ctx.createOscillator();
  const vca = ctx.createGain();
  const drive = createDrive(ctx, initial.drive);

  vca.gain.value = MIN_GAIN;
  oscillator.connect(filter.input);
  filter.output.connect(vca);
  vca.connect(drive.input);
  drive.output.connect(output);

  const params: Record<ParamTarget, AudioParam> = {
    frequency: oscillator.frequency,
    filterDetune: filter.detune,
    filterQ: filter.q,
    vca: vca.gain,
  };

  const apply = (event: ParamEvent) => applyAutomation(params[event.target], event, ctx);

  // Le plan fige la résonance du knob dans le retour de Q d'un accent. Un geste
  // fait entre la programmation de l'accent et ce retour doit l'emporter : la
  // voix garde la valeur du knob et reprogramme le retour avec elle.
  let knobQ = resonanceToQ(initial.resonance);
  let pendingQReturn: { readonly time: number; readonly timeConstant: number } | null = null;

  const applyParams = (next: BassParams) => {
    oscillator.type = next.waveform;
    smoothSet(oscillator.detune, tuningToCents(next.tuning), ctx);
    smoothSet(filter.frequency, cutoffToHz(next.cutoff), ctx);
    knobQ = resonanceToQ(next.resonance);
    smoothSet(filter.q, knobQ, ctx);
    if (pendingQReturn !== null && pendingQReturn.time > ctx.currentTime) {
      filter.q.setTargetAtTime(knobQ, pendingQReturn.time, pendingQReturn.timeConstant);
    }
    drive.setAmount(next.drive);
  };

  oscillator.type = initial.waveform;
  oscillator.detune.value = tuningToCents(initial.tuning);
  filter.frequency.value = cutoffToHz(initial.cutoff);
  filter.q.value = knobQ;
  oscillator.start();

  // Déduit de ce qui a été joué, pas du pattern : au premier play, après un
  // stop ou après une édition, aucune note ne sonne même si le pattern en lie une.
  let noteOpen = false;

  return {
    trigger(input) {
      const events = planStep({ ...input, held: noteOpen });
      events.forEach(apply);
      if (!input.step.rest) noteOpen = input.step.slide;
      const qReturn = events.findLast((event) => event.target === 'filterQ');
      if (qReturn?.kind === 'target') {
        pendingQReturn = {
          time: safeTime(ctx, qReturn.time),
          timeConstant: qReturn.timeConstant,
        };
      }
    },
    applyParams,
    release(time) {
      const at = safeTime(ctx, time);
      (Object.values(params) as AudioParam[]).forEach((param) => param.cancelScheduledValues(at));
      vca.gain.setTargetAtTime(MIN_GAIN, at, STOP_RELEASE_TAU_S);
      // Le cancel a pu effacer le retour d'un accent en cours : Q revient au knob.
      filter.q.setTargetAtTime(knobQ, at, KNOB_SMOOTHING_S);
      pendingQReturn = null;
      noteOpen = false;
    },
    dispose() {
      oscillator.stop();
      oscillator.disconnect();
      vca.disconnect();
      drive.dispose();
      filter.dispose();
    },
  };
}
