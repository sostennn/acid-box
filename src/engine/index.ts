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
  type AudioContextLike,
  type VisibilitySource,
} from './audio/context';
import type { TimerSource } from './clock/clock';
import { createPlayheadQueue } from './clock/playhead-queue';
import { createScheduler, type Scheduler } from './clock/scheduler';
import { createWorkerTimer } from './clock/worker-timer';
import type { Command } from './commands';
import {
  MIN_GAIN,
  START_DELAY_S,
  TEST_TONE_ATTACK_S,
  TEST_TONE_DECAY_S,
  TEST_TONE_FREQUENCY_HZ,
  TEST_TONE_PEAK_GAIN,
} from './model/constants';
import { createInitialState } from './model/defaults';
import type { EngineState, StepIndex } from './model/types';
import { reduce } from './state';
import { createAudioGraph, type AudioGraph } from './synth/graph';
import { createMetronome, type Metronome } from './synth/metronome';

export type { AudioAvailability, AudioInfo } from './audio/context';
export type { Command } from './commands';
export type * from './model/types';
export { BPM_MAX, BPM_MIN, STEP_COUNT } from './model/constants';

export interface EngineOptions {
  readonly createContext?: AudioContextFactory;
  readonly visibility?: VisibilitySource;
  readonly timer?: TimerSource;
}

export interface Engine {
  /** À appeler depuis un geste utilisateur : crée ou reprend l'AudioContext. */
  unlock(): Promise<void>;
  dispatch(command: Command): void;
  getState(): EngineState;
  subscribe(listener: (state: EngineState) => void): () => void;
  /** Pour la boucle d'affichage : pas audible à l'instant présent, null à l'arrêt. */
  audibleStep(): StepIndex | null;
  /** Son bref pour valider la chaîne audio. Provisoire : remplacé par la voix basse au lot 3. */
  playTestTone(): void;
  dispose(): void;
}

export function createEngine(options: EngineOptions = {}): Engine {
  const audio = createAudioManager(options);
  const timer = options.timer ?? createWorkerTimer();
  const playhead = createPlayheadQueue();
  const listeners = new Set<(state: EngineState) => void>();

  let state: EngineState = createInitialState(audio.info);
  let graph: AudioGraph | null = null;
  let scheduler: Scheduler | null = null;
  let metronome: Metronome | null = null;

  const setState = (next: EngineState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const stopAudioUpdates = audio.onChange((info) => setState({ ...state, audio: info }));

  const ensureGraph = (ctx: AudioContextLike): AudioGraph => {
    graph ??= createAudioGraph(ctx, state.mix);
    return graph;
  };

  const ensureScheduler = (ctx: AudioContextLike): Scheduler => {
    metronome ??= createMetronome(ctx, ensureGraph(ctx).master);
    scheduler ??= createScheduler({
      clock: { now: () => ctx.currentTime },
      timer,
      getTransport: () => state.transport,
      onStep: (step, time) => {
        metronome?.trigger(step, time);
        playhead.push({ step, time });
      },
    });
    return scheduler;
  };

  const play = async () => {
    // `unlock` appelle `resume()` de façon synchrone : si `dispatch` vient d'un
    // gestionnaire de geste, la politique d'autoplay est satisfaite.
    await audio.unlock();
    const ctx = audio.context;
    if (ctx === null || state.transport.status === 'playing') return;
    playhead.clear();
    ensureScheduler(ctx).start(ctx.currentTime + START_DELAY_S);
    setState(reduce(state, { type: 'transport/play' }));
  };

  const stop = () => {
    scheduler?.stop();
    playhead.clear();
    setState(reduce(state, { type: 'transport/stop' }));
  };

  return {
    unlock: () => audio.unlock(),
    dispatch(command) {
      switch (command.type) {
        case 'transport/play':
          void play();
          return;
        case 'transport/stop':
          stop();
          return;
        case 'mix/set':
          setState(reduce(state, command));
          graph?.applyMix(state.mix);
          return;
        default:
          setState(reduce(state, command));
      }
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    audibleStep() {
      const ctx = audio.context;
      if (ctx === null || state.transport.status !== 'playing') return null;
      // Un événement programmé à t s'entend à t + latence de sortie.
      return playhead.audibleStep(ctx.currentTime - state.audio.outputLatency);
    },
    playTestTone() {
      const ctx = audio.context;
      if (ctx === null || ctx.state !== 'running') return;

      const { master } = ensureGraph(ctx);
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
      vca.connect(master);
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        vca.disconnect();
      });
      oscillator.start(now);
      oscillator.stop(stopAt);
    },
    dispose() {
      scheduler?.stop();
      timer.dispose();
      graph?.dispose();
      stopAudioUpdates();
      listeners.clear();
      audio.dispose();
    },
  };
}
