/**
 * Voix basse monophonique : un oscillateur persistant, un étage de filtre, un
 * VCA et l'overdrive. Applique les plans d'automation de bass-plan.ts et les
 * knobs, sans décider de rien elle-même.
 */
import type { AudioContextLike } from '../../audio/context';
import { safeTime, smoothSet } from '../../audio/params';
import { MIN_GAIN, STOP_RELEASE_TAU_S } from '../../model/constants';
import { cutoffToHz, resonanceToQ, tuningToCents } from '../../model/mapping';
import type { BassParams, Step } from '../../model/types';
import type { FilterStage } from '../filter-stage';
import { planStep, type ParamEvent, type ParamTarget } from './bass-plan';
import { createDrive } from './drive';

export interface BassVoice {
  trigger(step: Step, time: number, stepDuration: number, params: BassParams): void;
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
    vca: vca.gain,
  };

  const apply = (event: ParamEvent) => {
    const param = params[event.target];
    const time = safeTime(ctx, event.time);
    switch (event.kind) {
      case 'cancel':
        param.cancelScheduledValues(time);
        return;
      case 'set':
        param.setValueAtTime(event.value, time);
        return;
      case 'expRamp':
        param.exponentialRampToValueAtTime(event.value, time);
        return;
      case 'target':
        param.setTargetAtTime(event.value, time, event.timeConstant);
        return;
    }
  };

  const applyParams = (next: BassParams) => {
    oscillator.type = next.waveform;
    smoothSet(oscillator.detune, tuningToCents(next.tuning), ctx);
    smoothSet(filter.frequency, cutoffToHz(next.cutoff), ctx);
    smoothSet(filter.q, resonanceToQ(next.resonance), ctx);
    drive.setAmount(next.drive);
  };

  oscillator.type = initial.waveform;
  oscillator.detune.value = tuningToCents(initial.tuning);
  filter.frequency.value = cutoffToHz(initial.cutoff);
  filter.q.value = resonanceToQ(initial.resonance);
  oscillator.start();

  return {
    trigger(step, time, stepDuration, current) {
      planStep({ step, params: current, time, stepDuration }).forEach(apply);
    },
    applyParams,
    release(time) {
      const at = safeTime(ctx, time);
      (Object.values(params) as AudioParam[]).forEach((param) => param.cancelScheduledValues(at));
      vca.gain.setTargetAtTime(MIN_GAIN, at, STOP_RELEASE_TAU_S);
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
