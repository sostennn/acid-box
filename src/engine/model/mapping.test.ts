import { describe, expect, it } from 'vitest';
import {
  CUTOFF_MAX_HZ,
  CUTOFF_MIN_HZ,
  DECAY_MAX_S,
  DECAY_MIN_S,
  DRIVE_MAX_GAIN,
  ENV_MOD_MAX_OCTAVES,
  RESONANCE_Q_MAX_DB,
  RESONANCE_Q_MIN_DB,
  TUNING_RANGE_SEMITONES,
} from './constants';
import {
  cutoffToHz,
  decayToSeconds,
  driveMakeupGain,
  driveToPreGain,
  envModToCents,
  expMap,
  levelToGain,
  resonanceToQ,
  tuningToCents,
} from './mapping';

function expectMonotone(fn: (value: number) => number) {
  let previous = -Infinity;
  for (let i = 0; i <= 20; i += 1) {
    const next = fn(i / 20);
    expect(next).toBeGreaterThan(previous);
    previous = next;
  }
}

describe('mappings', () => {
  it('levelToGain est quadratique', () => {
    expect(levelToGain(0)).toBe(0);
    expect(levelToGain(0.5)).toBeCloseTo(0.25, 10);
    expect(levelToGain(1)).toBe(1);
    expectMonotone((v) => levelToGain(v) + v * 1e-9);
  });

  it('expMap est exponentielle : le milieu du knob est la moyenne géométrique', () => {
    expect(expMap(0, 10, 1000)).toBe(10);
    expect(expMap(1, 10, 1000)).toBeCloseTo(1000, 6);
    expect(expMap(0.5, 10, 1000)).toBeCloseTo(100, 6);
  });

  it('les courbes respectent leurs bornes et sont monotones', () => {
    expect(cutoffToHz(0)).toBe(CUTOFF_MIN_HZ);
    expect(cutoffToHz(1)).toBeCloseTo(CUTOFF_MAX_HZ, 6);
    expectMonotone(cutoffToHz);

    expect(resonanceToQ(0)).toBe(RESONANCE_Q_MIN_DB);
    expect(resonanceToQ(1)).toBeCloseTo(RESONANCE_Q_MAX_DB, 6);
    expectMonotone(resonanceToQ);

    expect(decayToSeconds(0)).toBe(DECAY_MIN_S);
    expect(decayToSeconds(1)).toBeCloseTo(DECAY_MAX_S, 6);
    expectMonotone(decayToSeconds);

    expect(driveToPreGain(0)).toBe(1);
    expect(driveToPreGain(1)).toBeCloseTo(DRIVE_MAX_GAIN, 6);
    expectMonotone(driveToPreGain);
  });

  it('resonanceToQ est linéaire en dB : le milieu du knob est la moyenne des bornes', () => {
    expect(resonanceToQ(0.5)).toBeCloseTo((RESONANCE_Q_MIN_DB + RESONANCE_Q_MAX_DB) / 2, 10);
  });

  it('envModToCents va de 0 à ENV_MOD_MAX_OCTAVES octaves', () => {
    expect(envModToCents(0)).toBe(0);
    expect(envModToCents(1)).toBe(ENV_MOD_MAX_OCTAVES * 1200);
  });

  it('tuning est centré et symétrique', () => {
    expect(tuningToCents(0.5)).toBe(0);
    expect(tuningToCents(1)).toBe(TUNING_RANGE_SEMITONES * 100);
    expect(tuningToCents(0)).toBe(-TUNING_RANGE_SEMITONES * 100);
  });

  it('la compensation de drive diminue quand le pré-gain augmente', () => {
    expect(driveMakeupGain(1)).toBe(1);
    expect(driveMakeupGain(DRIVE_MAX_GAIN)).toBeLessThan(1);
    expect(driveMakeupGain(DRIVE_MAX_GAIN)).toBeGreaterThan(0.3);
  });
});
