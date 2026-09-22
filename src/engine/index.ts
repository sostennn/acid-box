/**
 * API publique du moteur audio. C'est le seul module du moteur que
 * l'interface a le droit d'importer.
 *
 * Le moteur possède son état, l'interface lui envoie des commandes et lit
 * des snapshots immuables pour l'affichage.
 */
import {
  createAudioManager,
  type AudioContextFactory,
  type AudioInfo,
  type VisibilitySource,
} from './audio/context';
import {
  MIN_GAIN,
  TEST_TONE_ATTACK_S,
  TEST_TONE_DECAY_S,
  TEST_TONE_FREQUENCY_HZ,
  TEST_TONE_PEAK_GAIN,
} from './model/constants';

export type { AudioAvailability, AudioInfo } from './audio/context';

export interface EngineState {
  readonly audio: AudioInfo;
}

export interface EngineOptions {
  readonly createContext?: AudioContextFactory;
  readonly visibility?: VisibilitySource;
}

export interface Engine {
  /** À appeler depuis un geste utilisateur : crée ou reprend l'AudioContext. */
  unlock(): Promise<void>;
  getState(): EngineState;
  subscribe(listener: (state: EngineState) => void): () => void;
  /** Son bref pour valider la chaîne audio. Provisoire : remplacé par la voix basse au lot 3. */
  playTestTone(): void;
  dispose(): void;
}

export function createEngine(options: EngineOptions = {}): Engine {
  const audio = createAudioManager(options);
  const listeners = new Set<(state: EngineState) => void>();
  let state: EngineState = { audio: audio.info };

  const stopAudioUpdates = audio.onChange((info) => {
    state = { ...state, audio: info };
    listeners.forEach((listener) => listener(state));
  });

  return {
    unlock: () => audio.unlock(),
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    playTestTone() {
      const ctx = audio.context;
      if (ctx === null || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const stopAt = now + TEST_TONE_ATTACK_S + TEST_TONE_DECAY_S;

      const oscillator = ctx.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(TEST_TONE_FREQUENCY_HZ, now);

      const vca = ctx.createGain();
      vca.gain.setValueAtTime(MIN_GAIN, now);
      vca.gain.exponentialRampToValueAtTime(TEST_TONE_PEAK_GAIN, now + TEST_TONE_ATTACK_S);
      vca.gain.exponentialRampToValueAtTime(MIN_GAIN, stopAt);

      oscillator.connect(vca);
      vca.connect(ctx.destination);
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        vca.disconnect();
      });
      oscillator.start(now);
      oscillator.stop(stopAt);
    },
    dispose() {
      stopAudioUpdates();
      listeners.clear();
      audio.dispose();
    },
  };
}
