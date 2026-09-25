import { describe, expect, it } from 'vitest';
import { DRUM_VELOCITY_DECAY_SPREAD } from '../../model/constants';
import { planDrumHit } from './drum-plan';

describe('planDrumHit', () => {
  it('un pas inactif ou une voix mutée ne joue rien', () => {
    expect(planDrumHit(0, false)).toBeNull();
    expect(planDrumHit(NaN, false)).toBeNull();
    expect(planDrumHit(1, true)).toBeNull();
  });

  it('le niveau et la queue croissent avec la vélocité', () => {
    const velocities = [0.1, 0.25, 0.5, 0.75, 1];
    const specs = velocities.map((v) => planDrumHit(v, false));
    for (let i = 1; i < specs.length; i += 1) {
      expect(specs[i]?.gain).toBeGreaterThan(specs[i - 1]?.gain ?? Infinity);
      expect(specs[i]?.decayScale).toBeGreaterThan(specs[i - 1]?.decayScale ?? Infinity);
    }
  });

  it('pleine vélocité : pic à 1 et queue nominale ; la queue ne tombe jamais sous le plancher', () => {
    expect(planDrumHit(1, false)).toEqual({ gain: 1, decayScale: 1 });
    expect(planDrumHit(3, false)).toEqual({ gain: 1, decayScale: 1 });
    expect(planDrumHit(1e-6, false)?.decayScale).toBeCloseTo(1 - DRUM_VELOCITY_DECAY_SPREAD, 5);
  });
});
