import { describe, expect, it } from 'vitest';
import { FakeAudioParam } from '../../../tests/fakes/fake-audio-context';
import { KNOB_SMOOTHING_S, SCHEDULE_EPSILON_S } from '../model/constants';
import { safeTime, smoothSet } from './params';

describe('safeTime', () => {
  it('laisse passer un temps futur et repousse un temps passé', () => {
    const ctx = { currentTime: 10 };
    expect(safeTime(ctx, 12)).toBe(12);
    expect(safeTime(ctx, 9)).toBeCloseTo(10 + SCHEDULE_EPSILON_S, 10);
  });
});

describe('smoothSet', () => {
  it('écrit par setTargetAtTime avec la constante de lissage', () => {
    const param = new FakeAudioParam();
    smoothSet(param, 0.3, { currentTime: 4 });
    expect(param.calls).toEqual([
      { method: 'setTargetAtTime', value: 0.3, time: 4, timeConstant: KNOB_SMOOTHING_S },
    ]);
    expect(param.value).toBe(0);
  });
});
