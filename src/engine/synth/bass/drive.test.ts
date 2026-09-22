import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../../tests/fakes/fake-audio-context';
import { DRIVE_CURVE_SAMPLES } from '../../model/constants';
import { createDrive, makeTanhCurve } from './drive';

describe('makeTanhCurve', () => {
  it('est impaire, bornée à ±1 et monotone', () => {
    const curve = makeTanhCurve();
    expect(curve).toHaveLength(DRIVE_CURVE_SAMPLES);
    expect(curve[0]).toBeCloseTo(-1, 6);
    expect(curve[DRIVE_CURVE_SAMPLES - 1]).toBeCloseTo(1, 6);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i]).toBeGreaterThan(curve[i - 1] ?? -Infinity);
    }
  });
});

describe('createDrive', () => {
  it('câble pré-gain → shaper → post-gain et ne régénère pas la courbe au réglage', () => {
    const ctx = new FakeAudioContext();
    const drive = createDrive(ctx.asContext(), 0);
    const [pre, post] = ctx.gains;
    const [shaper] = ctx.shapers;
    expect(pre?.connections).toContain(shaper);
    expect(shaper?.connections).toContain(post);
    expect(shaper?.oversample).toBe('2x');
    const curve = shaper?.curve;

    drive.setAmount(1);
    expect(shaper?.curve).toBe(curve);
    expect(pre?.gain.calls.at(-1)?.method).toBe('setTargetAtTime');
    expect(post?.gain.calls.at(-1)?.method).toBe('setTargetAtTime');
    expect(pre?.gain.calls.at(-1)?.value ?? 0).toBeGreaterThan(1);
  });
});
