import { describe, expect, it } from 'vitest';
import type { AudioInfo } from '../audio/context';
import { BPM_MAX } from '../model/constants';
import { createInitialState } from '../model/defaults';
import type { EngineState } from '../model/types';
import { reduce } from '../state';
import { persistedChanged, restoreState, serialize } from './serialize';

const AUDIO: AudioInfo = { availability: 'locked', sampleRate: null, outputLatency: 0 };
const initial = createInitialState(AUDIO);

/** Un état où chaque partie sauvegardée s'écarte des valeurs par défaut. */
function edited(): EngineState {
  const commands: Parameters<typeof reduce>[1][] = [
    { type: 'transport/setBpm', bpm: 138 },
    { type: 'transport/setShuffle', value: 0.4 },
    { type: 'transport/setSidechain', patch: { enabled: false, amount: 0.9 } },
    { type: 'bass/setWaveform', waveform: 'square' },
    { type: 'bass/setKnob', knob: 'tuning', value: 0.1 },
    { type: 'bass/setKnob', knob: 'cutoff', value: 0.2 },
    { type: 'bass/setKnob', knob: 'resonance', value: 0.3 },
    { type: 'bass/setKnob', knob: 'envMod', value: 0.4 },
    { type: 'bass/setKnob', knob: 'decay', value: 0.5 },
    { type: 'bass/setKnob', knob: 'accent', value: 0.6 },
    { type: 'bass/setKnob', knob: 'drive', value: 0.7 },
    { type: 'drums/setLevel', voice: 'clap', value: 0.2 },
    { type: 'drums/setMuted', voice: 'openHat', muted: true },
    { type: 'mix/set', patch: { bassLevel: 0.1, drumsLevel: 0.2, masterLevel: 0.3 } },
    {
      type: 'generator/setParams',
      patch: { scale: 'phrygian', root: 9, noteDensity: 0.9, slideDensity: 0.1, seed: 42 },
    },
    { type: 'pattern/setStep', index: 3, patch: { note: 7, octave: -1, rest: false } },
    { type: 'pattern/toggleStepFlag', index: 3, flag: 'accent' },
    { type: 'pattern/setDrumVelocity', voice: 'kick', index: 5, velocity: 0.35 },
  ];
  return commands.reduce((state, command) => reduce(state, command), initial);
}

/** Ce qui est sauvegardé, pour comparer deux états. */
const persistedPart = (state: EngineState) => ({
  pattern: state.pattern,
  bass: state.bass,
  drums: state.drums,
  mix: state.mix,
  transport: state.transport,
  generator: state.generator,
});

type Path = readonly (string | number)[];

/**
 * Remplace des valeurs du JSON sauvegardé, pour fabriquer un payload abîmé ;
 * `undefined` retire la clé (JSON.stringify l'omet).
 */
function tamper(state: EngineState, ...edits: readonly (readonly [Path, unknown])[]): string {
  const data: unknown = JSON.parse(serialize(state));
  for (const [path, value] of edits) {
    let node = data as Record<string | number, unknown>;
    for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
    node[path[path.length - 1] ?? ''] = value;
  }
  return JSON.stringify(data);
}

describe('serialize / restoreState', () => {
  it('aller-retour : chaque réglage sauvegardé revient à l’identique', () => {
    const state = edited();
    const restored = restoreState(serialize(state), AUDIO);
    expect(persistedPart(restored)).toEqual(persistedPart(state));
  });

  it('ne sauvegarde ni l’état audio, ni la lecture, ni l’undo du générateur', () => {
    const playing = reduce(reduce(edited(), { type: 'transport/play' }), {
      type: 'generator/run',
      seed: 1,
    });
    const data = JSON.parse(serialize(playing)) as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(
      ['bass', 'drums', 'generator', 'mix', 'pattern', 'transport', 'version'].sort(),
    );
    expect(data['transport']).not.toHaveProperty('status');

    const restored = restoreState(serialize(playing), AUDIO);
    expect(restored.transport.status).toBe('stopped');
    expect(restored.previousBass).toBeNull();
    expect(restored.audio).toBe(AUDIO);
  });

  it('reconstruit les mutes entendus à partir des mutes demandés', () => {
    const restored = restoreState(serialize(edited()), AUDIO);
    expect(restored.appliedMutes.openHat).toBe(true);
    expect(restored.appliedMutes.kick).toBe(false);
  });

  it('rien de sauvegardé : valeurs par défaut', () => {
    expect(restoreState(null, AUDIO)).toEqual(initial);
  });

  it('structure invalide : valeurs par défaut', () => {
    const state = edited();
    const corrupted = [
      '{ pas du json',
      'null',
      '[]',
      tamper(state, [['version'], 2]),
      tamper(state, [['mix'], undefined]),
      tamper(state, [['pattern', 'bass', 4, 'note'], 'C']),
      tamper(state, [['pattern', 'bass'], state.pattern.bass.slice(0, 15)]),
      tamper(state, [['pattern', 'drums', 'clap'], undefined]),
      tamper(state, [['bass', 'waveform'], 'triangle']),
      tamper(state, [['drums', 'kick', 'muted'], 'oui']),
      tamper(state, [['generator', 'scale'], 'dorian']),
      tamper(state, [['generator', 'seed'], '42']),
      tamper(state, [['transport', 'sidechain'], true]),
    ];
    for (const json of corrupted) expect(restoreState(json, AUDIO)).toEqual(initial);
  });

  it('valeur hors bornes : ramenée dans ses bornes, le reste est gardé', () => {
    const json = tamper(
      edited(),
      [['transport', 'bpm'], 999],
      [['transport', 'shuffle'], -1],
      [['bass', 'cutoff'], 3],
      [['pattern', 'bass', 3, 'note'], 14.2],
      [['pattern', 'bass', 3, 'octave'], 2],
      [['pattern', 'drums', 'kick', 5], 7],
      [['generator', 'root'], -4],
      [['generator', 'seed'], -1],
    );
    const restored = restoreState(json, AUDIO);
    expect(restored.transport).toMatchObject({ bpm: BPM_MAX, shuffle: 0 });
    expect(restored.bass).toMatchObject({ cutoff: 1, waveform: 'square' });
    expect(restored.pattern.bass[3]).toMatchObject({ note: 11, octave: 1, accent: true });
    expect(restored.pattern.drums.kick[5]).toBe(1);
    expect(restored.generator).toMatchObject({ root: 0, seed: 2 ** 32 - 1, scale: 'phrygian' });
    expect(restored.mix).toEqual(edited().mix);
  });
});

describe('persistedChanged', () => {
  it('suit les réglages, pas l’état audio, la lecture ni l’undo', () => {
    const audio = { ...initial, audio: { ...AUDIO, availability: 'running' as const } };
    expect(persistedChanged(initial, audio)).toBe(false);
    expect(persistedChanged(initial, reduce(initial, { type: 'transport/play' }))).toBe(false);
    expect(persistedChanged(initial, { ...initial, previousBass: initial.pattern.bass })).toBe(
      false,
    );

    expect(persistedChanged(initial, reduce(initial, { type: 'transport/setBpm', bpm: 90 }))).toBe(
      true,
    );
    const muted = reduce(initial, { type: 'drums/setMuted', voice: 'kick', muted: true });
    expect(persistedChanged(initial, muted)).toBe(true);
    const run = reduce(initial, { type: 'generator/run', seed: 3 });
    expect(persistedChanged(initial, run)).toBe(true);
  });
});
