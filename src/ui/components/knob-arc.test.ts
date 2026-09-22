import { describe, expect, it } from 'vitest';
import { KNOB_SWEEP_DEG, knobAngle, knobArcPath } from './knob-arc';

describe('knobAngle', () => {
  it('est symétrique autour du haut', () => {
    expect(knobAngle(0)).toBe(-KNOB_SWEEP_DEG / 2);
    expect(knobAngle(0.5)).toBe(0);
    expect(knobAngle(1)).toBe(KNOB_SWEEP_DEG / 2);
  });
});

describe('knobArcPath', () => {
  it('est vide pour un arc nul et utilise le grand arc au-delà de 180°', () => {
    expect(knobArcPath(0.3, 0.3)).toBe('');
    expect(knobArcPath(0, 0.5)).toContain(' 0 0 1 ');
    expect(knobArcPath(0, 1)).toContain(' 0 1 1 ');
  });

  it('accepte un intervalle inversé (arc bipolaire sous le centre)', () => {
    expect(knobArcPath(0.5, 0.2)).toBe(knobArcPath(0.2, 0.5));
  });
});
