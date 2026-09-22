/**
 * Overdrive de sortie : pré-gain piloté par le knob, WaveShaper à courbe tanh
 * fixe, post-gain de compensation. La courbe n'est jamais régénérée pendant
 * le geste, seuls deux gains bougent.
 */
import type { AudioContextLike } from '../../audio/context';
import { smoothSet } from '../../audio/params';
import { DRIVE_CURVE_SAMPLES, DRIVE_CURVE_STEEPNESS } from '../../model/constants';
import { driveMakeupGain, driveToPreGain } from '../../model/mapping';
import type { Normalized } from '../../model/types';

export interface Drive {
  readonly input: AudioNode;
  readonly output: AudioNode;
  setAmount(drive: Normalized): void;
  dispose(): void;
}

export function makeTanhCurve(samples = DRIVE_CURVE_SAMPLES): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const norm = Math.tanh(DRIVE_CURVE_STEEPNESS);
  for (let i = 0; i < samples; i += 1) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * DRIVE_CURVE_STEEPNESS) / norm;
  }
  return curve;
}

export function createDrive(ctx: AudioContextLike, initial: Normalized): Drive {
  const pre = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const post = ctx.createGain();
  shaper.curve = makeTanhCurve();
  shaper.oversample = '2x';

  const preGain = driveToPreGain(initial);
  pre.gain.value = preGain;
  post.gain.value = driveMakeupGain(preGain);

  pre.connect(shaper);
  shaper.connect(post);

  return {
    input: pre,
    output: post,
    setAmount(drive) {
      const next = driveToPreGain(drive);
      smoothSet(pre.gain, next, ctx);
      smoothSet(post.gain, driveMakeupGain(next), ctx);
    },
    dispose() {
      pre.disconnect();
      shaper.disconnect();
      post.disconnect();
    },
  };
}
