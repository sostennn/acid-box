import type { AudioInfo } from '../audio/context';
import { BPM_DEFAULT } from './constants';
import type {
  BassParams,
  DrumMutes,
  DrumParams,
  DrumPattern,
  EngineState,
  GeneratorParams,
  MixParams,
  OctaveOffset,
  Pattern,
  PitchClass,
  Step,
  TransportState,
  Tuple16,
} from './types';

export function tuple16<T>(make: (index: number) => T): Tuple16<T> {
  return Array.from({ length: 16 }, (_, index) => make(index)) as unknown as Tuple16<T>;
}

export const DEFAULT_STEP: Step = { note: 0, octave: 0, accent: false, slide: false, rest: false };

const every = (offset: number, period: number, velocity: number) =>
  tuple16((index) => (index % period === offset ? velocity : 0));

/**
 * Groove house : kick sur les quatre temps, clap sur 2 et 4, hat ouvert entre
 * les temps, étouffé par le hat fermé du 16e suivant.
 */
export const DEFAULT_DRUM_PATTERN: DrumPattern = {
  kick: every(0, 4, 1),
  clap: every(4, 8, 0.9),
  closedHat: every(1, 2, 0.6),
  openHat: every(2, 4, 0.7),
};

interface LineStep {
  readonly note: PitchClass;
  readonly octave?: OctaveOffset;
  readonly accent?: true;
  readonly slide?: true;
}

/**
 * Une ligne acid classique en Do mineur : une tonique qui saute d'octave,
 * accents et slides pour le phrasé. Le slide du dernier pas relie la boucle.
 */
const DEFAULT_BASS_LINE: readonly (LineStep | null)[] = [
  { note: 0, accent: true },
  { note: 0, octave: 1, slide: true },
  { note: 0 },
  null,
  { note: 3, accent: true, slide: true },
  { note: 5 },
  { note: 0 },
  { note: 0, octave: 1, accent: true },
  null,
  { note: 10, octave: -1, slide: true },
  { note: 0 },
  { note: 0, accent: true },
  { note: 7, slide: true },
  null,
  { note: 0, octave: 1, accent: true },
  { note: 3, slide: true },
];

export const DEFAULT_PATTERN: Pattern = {
  bass: tuple16((index) => {
    const entry = DEFAULT_BASS_LINE[index];
    if (entry === null || entry === undefined) return { ...DEFAULT_STEP, rest: true };
    return { ...DEFAULT_STEP, ...entry };
  }),
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
  cutoff: 0.25,
  resonance: 0.75,
  envMod: 0.65,
  decay: 0.35,
  accent: 0.8,
  drive: 0.35,
};

export const DEFAULT_DRUMS: DrumParams = {
  kick: { level: 0.8, muted: false },
  clap: { level: 0.6, muted: false },
  closedHat: { level: 0.5, muted: false },
  openHat: { level: 0.5, muted: false },
};

export function mutesOf(drums: DrumParams): DrumMutes {
  return {
    kick: drums.kick.muted,
    clap: drums.clap.muted,
    closedHat: drums.closedHat.muted,
    openHat: drums.openHat.muted,
  };
}

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
    appliedMutes: mutesOf(DEFAULT_DRUMS),
    mix: DEFAULT_MIX,
    generator: DEFAULT_GENERATOR,
  };
}
