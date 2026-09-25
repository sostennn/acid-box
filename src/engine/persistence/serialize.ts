/**
 * État de travail ↔ JSON versionné. Une structure invalide (JSON illisible,
 * version inconnue, champ manquant ou mal typé) ramène aux valeurs par défaut ;
 * une valeur hors bornes est ramenée dans ses bornes par le reducer, pour qu'un
 * détail abîmé ne fasse pas perdre tout le pattern.
 */
import type { AudioInfo } from '../audio/context';
import type { ReducibleCommand } from '../commands';
import { createInitialState, DEFAULT_BASS, tuple16 } from '../model/defaults';
import { SCALE_IDS } from '../model/scales';
import {
  DRUM_VOICES,
  type BassKnobId,
  type BassParams,
  type DrumParams,
  type DrumVoiceId,
  type EngineState,
  type GeneratorParams,
  type MixParams,
  type OctaveOffset,
  type PersistedStateV1,
  type PitchClass,
  type Step,
  type StepIndex,
  type TransportParams,
  type Tuple16,
} from '../model/types';
import { clamp, reduce } from '../state';

const BASS_KNOBS = Object.keys(DEFAULT_BASS).filter((key): key is BassKnobId => key !== 'waveform');

export function serialize(state: EngineState): string {
  const { bpm, shuffle, sidechain } = state.transport;
  const persisted: PersistedStateV1 = {
    version: 1,
    pattern: state.pattern,
    bass: state.bass,
    drums: state.drums,
    mix: state.mix,
    transport: { bpm, shuffle, sidechain },
    generator: state.generator,
  };
  return JSON.stringify(persisted);
}

/** État initial du moteur : celui sauvegardé s'il est lisible, les valeurs par défaut sinon. */
export function restoreState(json: string | null, audio: AudioInfo): EngineState {
  const initial = createInitialState(audio);
  const persisted = json === null ? null : parse(json);
  if (persisted === null) return initial;
  return commandsFor(persisted).reduce((state, command) => reduce(state, command), initial);
}

/**
 * Vrai si une partie sauvegardée a changé : l'état audio, le statut de lecture et l'undo n'en sont pas.
 * À tenir aligné sur `PersistedStateV1` : un champ oublié ici ne déclenche aucune sauvegarde.
 */
export function persistedChanged(previous: EngineState, next: EngineState): boolean {
  return (
    previous.pattern !== next.pattern ||
    previous.bass !== next.bass ||
    previous.drums !== next.drums ||
    previous.mix !== next.mix ||
    previous.generator !== next.generator ||
    previous.transport.bpm !== next.transport.bpm ||
    previous.transport.shuffle !== next.transport.shuffle ||
    previous.transport.sidechain !== next.transport.sidechain
  );
}

/**
 * Rejoue l'état sauvegardé sous forme de commandes : le reducer borne chaque
 * valeur avec les mêmes règles que pour une commande de l'interface.
 */
function commandsFor(persisted: PersistedStateV1): ReducibleCommand[] {
  const { pattern, bass, drums, mix, transport, generator } = persisted;
  const indexes = tuple16((index) => index as StepIndex);
  return [
    { type: 'transport/setBpm', bpm: transport.bpm },
    { type: 'transport/setShuffle', value: transport.shuffle },
    { type: 'transport/setSidechain', patch: transport.sidechain },
    { type: 'bass/setWaveform', waveform: bass.waveform },
    ...BASS_KNOBS.map((knob): ReducibleCommand => ({
      type: 'bass/setKnob',
      knob,
      value: bass[knob],
    })),
    ...DRUM_VOICES.flatMap((voice): ReducibleCommand[] => [
      { type: 'drums/setLevel', voice, value: drums[voice].level },
      { type: 'drums/setMuted', voice, muted: drums[voice].muted },
    ]),
    { type: 'mix/set', patch: mix },
    { type: 'generator/setParams', patch: generator },
    ...indexes.map((index): ReducibleCommand => ({
      type: 'pattern/setStep',
      index,
      patch: pattern.bass[index],
    })),
    ...DRUM_VOICES.flatMap((voice) =>
      indexes.map((index): ReducibleCommand => ({
        type: 'pattern/setDrumVelocity',
        voice,
        index,
        velocity: pattern.drums[voice][index],
      })),
    ),
  ];
}

/* ---------- Lecture : structure vérifiée, valeurs laissées au reducer ---------- */

type Json = Readonly<Record<string, unknown>>;

function parse(json: string): PersistedStateV1 | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data) || data['version'] !== 1) return null;
  const pattern = readPattern(data['pattern']);
  const bass = readBass(data['bass']);
  const drums = readDrums(data['drums']);
  const mix = readMix(data['mix']);
  const transport = readTransport(data['transport']);
  const generator = readGenerator(data['generator']);
  if (!pattern || !bass || !drums || !mix || !transport || !generator) return null;
  return { version: 1, pattern, bass, drums, mix, transport, generator };
}

function readPattern(value: unknown): PersistedStateV1['pattern'] | null {
  if (!isRecord(value)) return null;
  const bass = readTuple16(value['bass'], readStep);
  const drums = readVoices(value['drums'], (row) =>
    readTuple16(row, (velocity) => (isNumber(velocity) ? velocity : null)),
  );
  return bass && drums && { bass, drums };
}

function readStep(value: unknown): Step | null {
  if (!isRecord(value)) return null;
  const { note, octave, accent, slide, rest } = value;
  if (!isNumber(note) || !isNumber(octave)) return null;
  if (!isBoolean(accent) || !isBoolean(slide) || !isBoolean(rest)) return null;
  return {
    // Le reducer ne borne pas les pas, qui ne viennent que de contrôles typés.
    note: clamp(Math.round(note), 0, 11) as PitchClass,
    octave: clamp(Math.round(octave), -1, 1) as OctaveOffset,
    accent,
    slide,
    rest,
  };
}

function readBass(value: unknown): BassParams | null {
  if (!isRecord(value)) return null;
  const waveform = value['waveform'];
  if (waveform !== 'sawtooth' && waveform !== 'square') return null;
  const knobs = readNumbers(value, BASS_KNOBS);
  return knobs && { waveform, ...knobs };
}

function readDrums(value: unknown): DrumParams | null {
  return readVoices(value, (entry) => {
    if (!isRecord(entry)) return null;
    const { level, muted } = entry;
    return isNumber(level) && isBoolean(muted) ? { level, muted } : null;
  });
}

function readVoices<T>(
  value: unknown,
  read: (entry: unknown) => T | null,
): Readonly<Record<DrumVoiceId, T>> | null {
  if (!isRecord(value)) return null;
  const kick = read(value['kick']);
  const clap = read(value['clap']);
  const closedHat = read(value['closedHat']);
  const openHat = read(value['openHat']);
  if (kick === null || clap === null || closedHat === null || openHat === null) return null;
  return { kick, clap, closedHat, openHat };
}

function readMix(value: unknown): MixParams | null {
  return isRecord(value) ? readNumbers(value, ['bassLevel', 'drumsLevel', 'masterLevel']) : null;
}

function readTransport(value: unknown): TransportParams | null {
  if (!isRecord(value)) return null;
  const { bpm, shuffle, sidechain } = value;
  if (!isNumber(bpm) || !isNumber(shuffle) || !isRecord(sidechain)) return null;
  const { enabled, amount } = sidechain;
  if (!isBoolean(enabled) || !isNumber(amount)) return null;
  return { bpm, shuffle, sidechain: { enabled, amount } };
}

function readGenerator(value: unknown): GeneratorParams | null {
  if (!isRecord(value)) return null;
  const { scale, root, seed } = value;
  const knownScale = SCALE_IDS.find((id) => id === scale);
  if (knownScale === undefined || !isNumber(root)) return null;
  if (seed !== null && !isNumber(seed)) return null;
  const densities = readNumbers(value, [
    'noteDensity',
    'accentDensity',
    'slideDensity',
    'octaveJumpDensity',
  ]);
  // La tonique est bornée par le reducer (`generator/setParams`).
  return densities && { scale: knownScale, root: root as PitchClass, seed, ...densities };
}

function readNumbers<K extends string>(
  value: Json,
  keys: readonly K[],
): Readonly<Record<K, number>> | null {
  const result: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const entry = value[key];
    if (!isNumber(entry)) return null;
    result[key] = entry;
  }
  // Chaque clé vient d'être lue et vérifiée.
  return result as Readonly<Record<K, number>>;
}

function readTuple16<T>(value: unknown, read: (item: unknown) => T | null): Tuple16<T> | null {
  if (!Array.isArray(value) || value.length !== 16) return null;
  const items: T[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed === null) return null;
    items.push(parsed);
  }
  return items as unknown as Tuple16<T>;
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
