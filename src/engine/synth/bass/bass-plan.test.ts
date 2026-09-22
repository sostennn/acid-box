import { describe, expect, it } from 'vitest';
import { GATE_RATIO, MIN_GAIN } from '../../model/constants';
import { DEFAULT_BASS, DEFAULT_STEP } from '../../model/defaults';
import { decayToSeconds, envModToCents } from '../../model/mapping';
import { midiToFrequency } from '../../model/pitch';
import { planStep, type ParamEvent } from './bass-plan';

const base = { params: DEFAULT_BASS, time: 10, stepDuration: 0.125 };

const ofTarget = (events: ParamEvent[], target: ParamEvent['target']) =>
  events.filter((event) => event.target === target);

describe('planStep', () => {
  it('un silence ne programme rien', () => {
    expect(planStep({ ...base, step: { ...DEFAULT_STEP, rest: true } })).toEqual([]);
  });

  it('pose la fréquence de la note au temps du pas', () => {
    const events = planStep({ ...base, step: { ...DEFAULT_STEP, note: 9, octave: -1 } });
    const freq = ofTarget(events, 'frequency');
    expect(freq[0]).toEqual({ target: 'frequency', kind: 'cancel', time: 10 });
    expect(freq[1]).toMatchObject({ kind: 'set', time: 10, value: midiToFrequency(36 - 12 + 9) });
  });

  it('ouvre puis ferme le VCA sur la longueur de gate', () => {
    const events = planStep({ ...base, step: DEFAULT_STEP });
    const vca = ofTarget(events, 'vca');
    expect(vca.map((event) => event.kind)).toEqual(['cancel', 'target', 'target']);
    expect(vca[1]).toMatchObject({ time: 10, value: 1 });
    expect(vca[2]).toMatchObject({ time: 10 + 0.125 * GATE_RATIO, value: MIN_GAIN });
  });

  it('l’enveloppe de filtre part du pic en cents et décroît vers 0 avec le decay', () => {
    const params = { ...DEFAULT_BASS, envMod: 0.8, decay: 0.3 };
    const events = planStep({ ...base, params, step: DEFAULT_STEP });
    const env = ofTarget(events, 'filterDetune');
    expect(env[1]).toMatchObject({ kind: 'set', value: envModToCents(0.8), time: 10 });
    expect(env[2]).toMatchObject({
      kind: 'target',
      value: 0,
      time: 10,
      timeConstant: decayToSeconds(0.3),
    });
  });

  it('ne produit jamais de rampe exponentielle vers une valeur nulle et garde des temps croissants', () => {
    const events = planStep({ ...base, step: DEFAULT_STEP });
    events.forEach((event) => {
      if (event.kind === 'expRamp') expect(event.value).toBeGreaterThan(0);
    });
    (['frequency', 'filterDetune', 'vca'] as const).forEach((target) => {
      const times = ofTarget(events, target).map((event) => event.time);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    });
  });
});
