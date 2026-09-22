import { describe, expect, it } from 'vitest';
import {
  BASE_OCTAVE_MIDI,
  PITCH_RANGE_SEMITONES,
  indexToPitch,
  midiToFrequency,
  pitchLabel,
  pitchToIndex,
  pitchToMidi,
} from './pitch';

describe('pitch', () => {
  it('C2 est la base, les octaves relatives décalent de 12', () => {
    expect(pitchToMidi({ note: 0, octave: 0 })).toBe(BASE_OCTAVE_MIDI);
    expect(pitchToMidi({ note: 0, octave: 1 })).toBe(BASE_OCTAVE_MIDI + 12);
    expect(pitchToMidi({ note: 7, octave: -1 })).toBe(BASE_OCTAVE_MIDI - 5);
  });

  it('convertit le MIDI en fréquence avec A4 = 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
    expect(midiToFrequency(BASE_OCTAVE_MIDI)).toBeCloseTo(65.406, 2);
  });

  it('index de hauteur et pas sont réciproques sur toute la plage', () => {
    for (let i = 0; i < PITCH_RANGE_SEMITONES; i += 1) {
      expect(pitchToIndex(indexToPitch(i))).toBe(i);
    }
    expect(indexToPitch(-5)).toEqual({ note: 0, octave: -1 });
    expect(indexToPitch(99)).toEqual({ note: 11, octave: 1 });
    expect(indexToPitch(12.4)).toEqual({ note: 0, octave: 0 });
  });

  it('nomme les hauteurs en notation scientifique', () => {
    expect(pitchLabel({ note: 0, octave: 0 })).toBe('C2');
    expect(pitchLabel({ note: 3, octave: 1 })).toBe('D#3');
    expect(pitchLabel({ note: 10, octave: -1 })).toBe('A#1');
  });
});
