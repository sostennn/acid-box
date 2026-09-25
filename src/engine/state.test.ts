import { describe, expect, it } from 'vitest';
import { BPM_MAX, BPM_MIN } from './model/constants';
import { createInitialState } from './model/defaults';
import { applyPendingMutes, reduce } from './state';

const initial = createInitialState({ availability: 'locked', sampleRate: null, outputLatency: 0 });

describe('reduce', () => {
  it('play et stop changent le statut sans muter l’état précédent', () => {
    const playing = reduce(initial, { type: 'transport/play' });
    expect(playing.transport.status).toBe('playing');
    expect(initial.transport.status).toBe('stopped');
    expect(playing).not.toBe(initial);
    expect(reduce(playing, { type: 'transport/stop' }).transport.status).toBe('stopped');
  });

  it('borne le tempo', () => {
    expect(reduce(initial, { type: 'transport/setBpm', bpm: 10 }).transport.bpm).toBe(BPM_MIN);
    expect(reduce(initial, { type: 'transport/setBpm', bpm: 999 }).transport.bpm).toBe(BPM_MAX);
    expect(reduce(initial, { type: 'transport/setBpm', bpm: 133 }).transport.bpm).toBe(133);
    expect(reduce(initial, { type: 'transport/setBpm', bpm: NaN }).transport.bpm).toBe(BPM_MIN);
  });

  it('borne le shuffle dans [0, 1]', () => {
    expect(reduce(initial, { type: 'transport/setShuffle', value: -1 }).transport.shuffle).toBe(0);
    expect(reduce(initial, { type: 'transport/setShuffle', value: 2 }).transport.shuffle).toBe(1);
    expect(reduce(initial, { type: 'transport/setShuffle', value: 0.3 }).transport.shuffle).toBe(
      0.3,
    );
  });

  it('pattern/setStep remplace un pas sans muter le tuple précédent', () => {
    const next = reduce(initial, {
      type: 'pattern/setStep',
      index: 3,
      patch: { note: 5, octave: 1 },
    });
    expect(next.pattern.bass[3]).toMatchObject({ note: 5, octave: 1 });
    expect(next.pattern.bass).toHaveLength(16);
    expect(next.pattern.bass[2]).toBe(initial.pattern.bass[2]);
    expect(initial.pattern.bass[3]).not.toMatchObject({ note: 5, octave: 1 });
  });

  it('pattern/toggleStepFlag inverse un drapeau', () => {
    const once = reduce(initial, { type: 'pattern/toggleStepFlag', index: 0, flag: 'rest' });
    expect(once.pattern.bass[0]?.rest).toBe(!initial.pattern.bass[0]?.rest);
    const twice = reduce(once, { type: 'pattern/toggleStepFlag', index: 0, flag: 'rest' });
    expect(twice.pattern.bass[0]?.rest).toBe(initial.pattern.bass[0]?.rest);
  });

  it('bass/setKnob borne et bass/setWaveform commute', () => {
    expect(reduce(initial, { type: 'bass/setKnob', knob: 'cutoff', value: 2 }).bass.cutoff).toBe(1);
    expect(reduce(initial, { type: 'bass/setKnob', knob: 'drive', value: 0.3 }).bass.drive).toBe(
      0.3,
    );
    expect(reduce(initial, { type: 'bass/setWaveform', waveform: 'square' }).bass.waveform).toBe(
      'square',
    );
  });

  it('mix/set fusionne et borne les niveaux', () => {
    const next = reduce(initial, { type: 'mix/set', patch: { masterLevel: 1.5, bassLevel: -1 } });
    expect(next.mix).toEqual({ ...initial.mix, masterLevel: 1, bassLevel: 0 });
    expect(initial.mix.masterLevel).not.toBe(1);
  });

  it('transport/setSidechain fusionne et borne amount', () => {
    const off = reduce(initial, { type: 'transport/setSidechain', patch: { enabled: false } });
    expect(off.transport.sidechain).toEqual({ ...initial.transport.sidechain, enabled: false });
    const loud = reduce(initial, { type: 'transport/setSidechain', patch: { amount: 3 } });
    expect(loud.transport.sidechain.amount).toBe(1);
    expect(loud.transport.bpm).toBe(initial.transport.bpm);
  });

  it('pattern/setDrumVelocity remplace un pas d’une seule voix, borné', () => {
    const next = reduce(initial, {
      type: 'pattern/setDrumVelocity',
      voice: 'clap',
      index: 2,
      velocity: 1.4,
    });
    expect(next.pattern.drums.clap[2]).toBe(1);
    expect(next.pattern.drums.clap).toHaveLength(16);
    expect(next.pattern.drums.kick).toBe(initial.pattern.drums.kick);
    expect(next.pattern.bass).toBe(initial.pattern.bass);
    expect(initial.pattern.drums.clap[2]).toBe(0);
    const cleared = reduce(next, {
      type: 'pattern/setDrumVelocity',
      voice: 'clap',
      index: 2,
      velocity: -1,
    });
    expect(cleared.pattern.drums.clap[2]).toBe(0);
  });

  it('drums/setMuted et drums/setLevel ne touchent qu’une voix', () => {
    const muted = reduce(initial, { type: 'drums/setMuted', voice: 'openHat', muted: true });
    expect(muted.drums.openHat).toEqual({ ...initial.drums.openHat, muted: true });
    expect(muted.drums.kick).toBe(initial.drums.kick);
    const level = reduce(initial, { type: 'drums/setLevel', voice: 'kick', value: 2 });
    expect(level.drums.kick).toEqual({ ...initial.drums.kick, level: 1 });
  });

  it('à l’arrêt, un mute s’applique aussitôt', () => {
    const next = reduce(initial, { type: 'drums/setMuted', voice: 'clap', muted: true });
    expect(next.appliedMutes.clap).toBe(true);
    expect(initial.appliedMutes.clap).toBe(false);
  });

  it('en lecture, un mute reste en attente jusqu’à applyPendingMutes', () => {
    const playing = reduce(initial, { type: 'transport/play' });
    const requested = reduce(playing, { type: 'drums/setMuted', voice: 'clap', muted: true });
    expect(requested.drums.clap.muted).toBe(true);
    expect(requested.appliedMutes).toBe(playing.appliedMutes);

    const applied = applyPendingMutes(requested);
    expect(applied.appliedMutes.clap).toBe(true);
    expect(applyPendingMutes(applied)).toBe(applied);
  });

  it('stop applique les mutes en attente', () => {
    const playing = reduce(initial, { type: 'transport/play' });
    const requested = reduce(playing, { type: 'drums/setMuted', voice: 'kick', muted: true });
    expect(reduce(requested, { type: 'transport/stop' }).appliedMutes.kick).toBe(true);
  });

  it('ne touche pas au reste de l’état', () => {
    const next = reduce(initial, { type: 'transport/setBpm', bpm: 100 });
    expect(next.pattern).toBe(initial.pattern);
    expect(next.bass).toBe(initial.bass);
    expect(next.audio).toBe(initial.audio);
  });
});
