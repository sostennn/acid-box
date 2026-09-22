import { describe, expect, it } from 'vitest';
import { BPM_MAX, BPM_MIN } from './model/constants';
import { createInitialState } from './model/defaults';
import { reduce } from './state';

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

  it('ne touche pas au reste de l’état', () => {
    const next = reduce(initial, { type: 'transport/setBpm', bpm: 100 });
    expect(next.pattern).toBe(initial.pattern);
    expect(next.bass).toBe(initial.bass);
    expect(next.audio).toBe(initial.audio);
  });
});
