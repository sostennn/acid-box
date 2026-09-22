import { describe, expect, it } from 'vitest';
import {
  KNOB_DRAG_RANGE_PX,
  KNOB_FINE_FACTOR,
  KNOB_KEY_PAGE_STEP,
  KNOB_KEY_STEP,
  clamp01,
  valueFromDrag,
  valueFromKey,
} from './knob-math';

describe('clamp01', () => {
  it('borne dans [0, 1] et traite NaN comme 0', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(NaN)).toBe(0);
  });
});

describe('valueFromDrag', () => {
  it('monte vers le haut et vers la droite, descend vers le bas et la gauche', () => {
    expect(valueFromDrag(0.5, 0, -20, false)).toBeGreaterThan(0.5);
    expect(valueFromDrag(0.5, 20, 0, false)).toBeGreaterThan(0.5);
    expect(valueFromDrag(0.5, 0, 20, false)).toBeLessThan(0.5);
    expect(valueFromDrag(0.5, -20, 0, false)).toBeLessThan(0.5);
  });

  it('couvre toute la plage sur KNOB_DRAG_RANGE_PX et sature aux bornes', () => {
    expect(valueFromDrag(0, 0, -KNOB_DRAG_RANGE_PX, false)).toBe(1);
    expect(valueFromDrag(1, 0, KNOB_DRAG_RANGE_PX * 3, false)).toBe(0);
  });

  it('combine les deux axes et applique le facteur fin', () => {
    const coarse = valueFromDrag(0.5, 10, -10, false);
    const fine = valueFromDrag(0.5, 10, -10, true);
    expect(coarse - 0.5).toBeCloseTo(20 / KNOB_DRAG_RANGE_PX, 10);
    expect(fine - 0.5).toBeCloseTo((20 / KNOB_DRAG_RANGE_PX) * KNOB_FINE_FACTOR, 10);
  });
});

describe('valueFromKey', () => {
  it('gère flèches, pages, Home et End, et ignore le reste', () => {
    expect(valueFromKey(0.5, 'ArrowUp')).toBeCloseTo(0.5 + KNOB_KEY_STEP, 10);
    expect(valueFromKey(0.5, 'ArrowRight')).toBeCloseTo(0.5 + KNOB_KEY_STEP, 10);
    expect(valueFromKey(0.5, 'ArrowDown')).toBeCloseTo(0.5 - KNOB_KEY_STEP, 10);
    expect(valueFromKey(0.5, 'ArrowLeft')).toBeCloseTo(0.5 - KNOB_KEY_STEP, 10);
    expect(valueFromKey(0.5, 'PageUp')).toBeCloseTo(0.5 + KNOB_KEY_PAGE_STEP, 10);
    expect(valueFromKey(0.5, 'PageDown')).toBeCloseTo(0.5 - KNOB_KEY_PAGE_STEP, 10);
    expect(valueFromKey(0.5, 'Home')).toBe(0);
    expect(valueFromKey(0.5, 'End')).toBe(1);
    expect(valueFromKey(1, 'ArrowUp')).toBe(1);
    expect(valueFromKey(0.5, 'a')).toBeNull();
  });
});
