import { describe, expect, it } from 'vitest';
import { stepDurationSeconds } from '../../clock/timing';
import {
  ACCENT_ENV_DECAY_S,
  ACCENT_MAX_GAIN_BOOST,
  ACCENT_MAX_OCTAVES,
  ACCENT_Q_BOOST_DB,
  BPM_DEFAULT,
  GATE_RATIO,
  MIN_GAIN,
  SLIDE_TAU_S,
} from '../../model/constants';
import { DEFAULT_BASS, DEFAULT_STEP } from '../../model/defaults';
import { decayToSeconds, envModToCents, resonanceToQ } from '../../model/mapping';
import { BASE_OCTAVE_MIDI, midiToFrequency } from '../../model/pitch';
import { planStep, type ParamEvent } from './bass-plan';

const STEP_S = stepDurationSeconds(BPM_DEFAULT);
const base = { params: DEFAULT_BASS, held: false, time: 10, stepDuration: STEP_S };
const gateEnd = 10 + STEP_S * GATE_RATIO;

const ofTarget = (events: ParamEvent[], target: ParamEvent['target']) =>
  events.filter((event) => event.target === target);

function expectSane(events: ParamEvent[]) {
  events.forEach((event) => {
    if (event.kind === 'target') expect(event.timeConstant).toBeGreaterThan(0);
  });
  (['frequency', 'filterDetune', 'filterQ', 'vca'] as const).forEach((target) => {
    const times = ofTarget(events, target).map((event) => event.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
}

describe('planStep — note simple', () => {
  it('un silence ne programme rien', () => {
    expect(planStep({ ...base, step: { ...DEFAULT_STEP, rest: true } })).toEqual([]);
  });

  it('pose la fréquence de la note au temps du pas', () => {
    const events = planStep({ ...base, step: { ...DEFAULT_STEP, note: 9, octave: -1 } });
    const freq = ofTarget(events, 'frequency');
    expect(freq[0]).toEqual({ target: 'frequency', kind: 'cancel', time: 10 });
    expect(freq[1]).toMatchObject({
      kind: 'set',
      time: 10,
      value: midiToFrequency(BASE_OCTAVE_MIDI - 12 + 9),
    });
    expectSane(events);
  });

  it('ouvre puis ferme le VCA sur la longueur de gate, sans toucher à Q', () => {
    const events = planStep({ ...base, step: DEFAULT_STEP });
    const vca = ofTarget(events, 'vca');
    expect(vca.map((event) => event.kind)).toEqual(['cancel', 'target', 'target']);
    expect(vca[1]).toMatchObject({ time: 10, value: 1 });
    expect(vca[2]).toMatchObject({ time: gateEnd, value: MIN_GAIN });
    expect(ofTarget(events, 'filterQ')).toEqual([]);
  });

  it('l’enveloppe de filtre part du pic en cents et décroît vers 0 avec le decay', () => {
    const params = { ...DEFAULT_BASS, envMod: 0.8, decay: 0.3 };
    const events = planStep({ ...base, params, step: DEFAULT_STEP });
    const env = ofTarget(events, 'filterDetune');
    expect(env[1]).toMatchObject({ kind: 'set', value: envModToCents(0.8), time: 10 });
    expect(env[2]).toMatchObject({ kind: 'target', value: 0, timeConstant: decayToSeconds(0.3) });
  });
});

describe('planStep — accent', () => {
  const params = { ...DEFAULT_BASS, accent: 0.5, resonance: 0.5, envMod: 0.2, decay: 1 };
  const events = planStep({ ...base, params, step: { ...DEFAULT_STEP, accent: true } });

  it('pousse le VCA au-dessus de 1, dosé par le knob accent', () => {
    const attack = ofTarget(events, 'vca')[1];
    expect(attack).toMatchObject({ value: 1 + 0.5 * ACCENT_MAX_GAIN_BOOST });
  });

  it('ajoute des octaves à l’ouverture du filtre et fixe la décroissance courte', () => {
    const env = ofTarget(events, 'filterDetune');
    expect(env[1]).toMatchObject({ value: envModToCents(0.2) + 0.5 * ACCENT_MAX_OCTAVES * 1200 });
    expect(env[2]).toMatchObject({ timeConstant: ACCENT_ENV_DECAY_S });
  });

  it('pousse la résonance de quelques dB puis la ramène à la valeur du knob', () => {
    const q = ofTarget(events, 'filterQ');
    const knobQ = resonanceToQ(0.5);
    expect(q.map((event) => event.kind)).toEqual(['cancel', 'target', 'target']);
    expect(q[1]).toMatchObject({ time: 10, value: knobQ + 0.5 * ACCENT_Q_BOOST_DB });
    expect(q[2]).toMatchObject({ value: knobQ, timeConstant: ACCENT_ENV_DECAY_S });
    expectSane(events);
  });

  it('un accent à 0 sur le knob ne change rien au VCA ni au filtre', () => {
    const flat = planStep({
      ...base,
      params: { ...params, accent: 0 },
      step: { ...DEFAULT_STEP, accent: true },
    });
    expect(ofTarget(flat, 'vca')[1]).toMatchObject({ value: 1 });
    expect(ofTarget(flat, 'filterDetune')[1]).toMatchObject({ value: envModToCents(0.2) });
  });
});

describe('planStep — slide', () => {
  it('un pas qui slide laisse le VCA ouvert', () => {
    const events = planStep({ ...base, step: { ...DEFAULT_STEP, slide: true } });
    const vca = ofTarget(events, 'vca');
    expect(vca.some((event) => event.kind === 'target' && event.value === MIN_GAIN)).toBe(false);
    expect(vca.some((event) => event.kind === 'target' && event.value === 1)).toBe(true);
  });

  it('un pas tenu glisse depuis la hauteur qui sonne sans rien redéclencher', () => {
    const events = planStep({ ...base, held: true, step: { ...DEFAULT_STEP, note: 7 } });
    const freq = ofTarget(events, 'frequency');
    expect(freq).toEqual([
      { target: 'frequency', kind: 'cancel', time: 10 },
      {
        target: 'frequency',
        kind: 'target',
        time: 10,
        value: midiToFrequency(BASE_OCTAVE_MIDI + 7),
        timeConstant: SLIDE_TAU_S,
      },
    ]);

    expect(ofTarget(events, 'filterDetune')).toEqual([]);
    expect(ofTarget(events, 'filterQ')).toEqual([]);
    const vca = ofTarget(events, 'vca');
    expect(vca).toEqual([
      {
        target: 'vca',
        kind: 'target',
        time: gateEnd,
        value: MIN_GAIN,
        timeConstant: expect.any(Number),
      },
    ]);
    expectSane(events);
  });

  it('une chaîne de slides ne ferme jamais le VCA', () => {
    const events = planStep({
      ...base,
      held: true,
      step: { ...DEFAULT_STEP, note: 3, slide: true },
    });
    expect(ofTarget(events, 'vca')).toEqual([]);
    expect(ofTarget(events, 'frequency').map((event) => event.kind)).toEqual(['cancel', 'target']);
  });

  it('un accent sur un pas tenu est ignoré', () => {
    const events = planStep({
      ...base,
      held: true,
      step: { ...DEFAULT_STEP, note: 5, accent: true },
    });
    expect(ofTarget(events, 'filterQ')).toEqual([]);
    expect(
      ofTarget(events, 'vca').some((event) => event.kind === 'target' && event.value > 1),
    ).toBe(false);
  });

  it('un slide vers la même note reste une liaison sans saut', () => {
    const events = planStep({ ...base, held: true, step: { ...DEFAULT_STEP, note: 0 } });
    expect(ofTarget(events, 'frequency')).toEqual([
      { target: 'frequency', kind: 'cancel', time: 10 },
      expect.objectContaining({
        kind: 'target',
        time: 10,
        value: midiToFrequency(BASE_OCTAVE_MIDI),
      }),
    ]);
  });
});
