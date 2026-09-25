/**
 * Modèle de données du moteur : pattern, pas, paramètres de voix, état global.
 * Tout est immuable côté lecture ; les reducers de state.ts produisent de
 * nouveaux snapshots.
 */
import type { AudioInfo } from '../audio/context';

/** Tuple de longueur fixe, évite les index hors-borne dans tout le moteur. */
export type Tuple16<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T];
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/* ---------- Hauteur ---------- */
/** 0 = C … 11 = B. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type OctaveOffset = -1 | 0 | 1;

/* ---------- Séquence basse ---------- */
export interface Step {
  readonly note: PitchClass;
  readonly octave: OctaveOffset;
  readonly accent: boolean;
  readonly slide: boolean;
  readonly rest: boolean;
}

export type BassPattern = Tuple16<Step>;

/* ---------- Séquence rythmique ---------- */
export type DrumVoiceId = 'kick' | 'clap' | 'closedHat' | 'openHat';
export const DRUM_VOICES: readonly DrumVoiceId[] = ['kick', 'clap', 'closedHat', 'openHat'];

/** 0 = pas inactif, ]0, 1] = vélocité. */
export type Velocity = number;
export type DrumPattern = Readonly<Record<DrumVoiceId, Tuple16<Velocity>>>;

export interface Pattern {
  readonly bass: BassPattern;
  readonly drums: DrumPattern;
}

/* ---------- Paramètres de voix ---------- */
/** Toute valeur de knob est normalisée dans [0, 1] ; mapping.ts fait la conversion. */
export type Normalized = number;

export type BassWaveform = 'sawtooth' | 'square';

export interface BassParams {
  readonly waveform: BassWaveform;
  /** 0.5 = accord de référence, plage ±TUNING_RANGE_SEMITONES. */
  readonly tuning: Normalized;
  readonly cutoff: Normalized;
  readonly resonance: Normalized;
  readonly envMod: Normalized;
  readonly decay: Normalized;
  readonly accent: Normalized;
  readonly drive: Normalized;
}
export type BassKnobId = Exclude<keyof BassParams, 'waveform'>;

export interface DrumVoiceParams {
  readonly level: Normalized;
  readonly muted: boolean;
}
export type DrumParams = Readonly<Record<DrumVoiceId, DrumVoiceParams>>;
export type DrumMutes = Readonly<Record<DrumVoiceId, boolean>>;

export interface MixParams {
  readonly bassLevel: Normalized;
  readonly drumsLevel: Normalized;
  readonly masterLevel: Normalized;
}

/* ---------- Transport ---------- */
export interface SidechainParams {
  readonly enabled: boolean;
  readonly amount: Normalized;
}

export interface TransportParams {
  /** En BPM, borné par BPM_MIN / BPM_MAX. */
  readonly bpm: number;
  /** 0 = droit, 1 = SHUFFLE_MAX_RATIO. */
  readonly shuffle: Normalized;
  readonly sidechain: SidechainParams;
}

export type TransportStatus = 'stopped' | 'playing';

export type TransportState = TransportParams & { readonly status: TransportStatus };

/* ---------- Générateur ---------- */
export type ScaleId = 'minor' | 'phrygian';

export interface GeneratorParams {
  readonly scale: ScaleId;
  readonly root: PitchClass;
  readonly noteDensity: Normalized;
  readonly accentDensity: Normalized;
  readonly slideDensity: Normalized;
  readonly octaveJumpDensity: Normalized;
  /** null = aléatoire à chaque run. */
  readonly seed: number | null;
}

/* ---------- État global (snapshot immuable exposé à l'interface) ---------- */
export interface EngineState {
  readonly audio: AudioInfo;
  readonly transport: TransportState;
  readonly pattern: Pattern;
  /**
   * Undo à un niveau du générateur : la ligne de basse d'avant le dernier run.
   * Effacé par toute édition manuelle d'un pas de basse, pour qu'un undo ne
   * défasse jamais une édition faite à la main.
   */
  readonly previousBass: BassPattern | null;
  readonly bass: BassParams;
  /** `muted` y est le mute demandé ; en lecture, il ne s'entend qu'à la mesure suivante. */
  readonly drums: DrumParams;
  /** Mute réellement appliqué : rejoint `drums` au pas 0 en lecture, aussitôt à l'arrêt. */
  readonly appliedMutes: DrumMutes;
  readonly mix: MixParams;
  readonly generator: GeneratorParams;
}

/* ---------- Tête de lecture (canal séparé, haute fréquence, hors snapshot) ---------- */
export interface PlayheadEvent {
  readonly step: StepIndex;
  /** Temps AudioContext auquel le pas est programmé. */
  readonly time: number;
}

/* ---------- Persistance ---------- */
/**
 * État de travail sauvegardé : ce que l'utilisateur a réglé, sans l'état
 * audio, le statut de lecture, les mutes entendus ni l'undo du générateur.
 */
export interface PersistedStateV1 {
  readonly version: 1;
  readonly pattern: Pattern;
  readonly bass: BassParams;
  readonly drums: DrumParams;
  readonly mix: MixParams;
  readonly transport: TransportParams;
  readonly generator: GeneratorParams;
}
