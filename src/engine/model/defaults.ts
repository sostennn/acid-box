import type { AudioInfo } from '../audio/context';
import { BPM_DEFAULT } from './constants';
import type {
  BassParams,
  DrumParams,
  DrumPattern,
  EngineState,
  GeneratorParams,
  MixParams,
  Pattern,
  Step,
  TransportState,
  Tuple16,
} from './types';

export function tuple16<T>(make: (index: number) => T): Tuple16<T> {
  return Array.from({ length: 16 }, (_, index) => make(index)) as unknown as Tuple16<T>;
}

export const DEFAULT_STEP: Step = { note: 0, octave: 0, accent: false, slide: false, rest: false };

export const DEFAULT_DRUM_PATTERN: DrumPattern = {
  kick: tuple16(() => 0),
  clap: tuple16(() => 0),
  closedHat: tuple16(() => 0),
  openHat: tuple16(() => 0),
};

export const DEFAULT_PATTERN: Pattern = {
  bass: tuple16(() => DEFAULT_STEP),
  drums: DEFAULT_DRUM_PATTERN,
};

export const DEFAULT_TRANSPORT: TransportState = {
  status: 'stopped',
  bpm: BPM_DEFAULT,
  shuffle: 0,
  sidechain: { enabled: true, amount: 0.5 },
};

export const DEFAULT_BASS: BassParams = {
  waveform: 'sawtooth',
  tuning: 0.5,
  cutoff: 0.4,
  resonance: 0.6,
  envMod: 0.5,
  decay: 0.4,
  accent: 0.6,
  drive: 0.2,
};

export const DEFAULT_DRUMS: DrumParams = {
  kick: { level: 0.8, muted: false },
  clap: { level: 0.6, muted: false },
  closedHat: { level: 0.5, muted: false },
  openHat: { level: 0.5, muted: false },
};

export const DEFAULT_MIX: MixParams = { bassLevel: 0.8, drumsLevel: 0.7, masterLevel: 0.8 };

export const DEFAULT_GENERATOR: GeneratorParams = {
  scale: 'minor',
  root: 0,
  noteDensity: 0.7,
  accentDensity: 0.3,
  slideDensity: 0.3,
  octaveJumpDensity: 0.2,
  seed: null,
};

export function createInitialState(audio: AudioInfo): EngineState {
  return {
    audio,
    transport: DEFAULT_TRANSPORT,
    pattern: DEFAULT_PATTERN,
    previousPattern: null,
    bass: DEFAULT_BASS,
    drums: DEFAULT_DRUMS,
    mix: DEFAULT_MIX,
    generator: DEFAULT_GENERATOR,
  };
}
