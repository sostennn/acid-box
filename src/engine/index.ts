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
import { stepDurationSeconds } from './clock/timing';
import { createWorkerTimer } from './clock/worker-timer';
import type { Command } from './commands';
import { START_DELAY_S } from './model/constants';
import { createInitialState } from './model/defaults';
import type { EngineState, StepIndex } from './model/types';
import { reduce } from './state';
import { createBassVoice, type BassVoice } from './synth/bass/bass-voice';
import { createBiquadFilterStage } from './synth/filter-stage';
import { createAudioGraph, type AudioGraph } from './synth/graph';

export type { AudioAvailability, AudioInfo } from './audio/context';
export type { Command, StepFlag } from './commands';
export type * from './model/types';
export { BPM_MAX, BPM_MIN, STEP_COUNT, TUNING_RANGE_SEMITONES } from './model/constants';
export { cutoffToHz, decayToSeconds, resonanceToQ, tuningToCents } from './model/mapping';
export { PITCH_RANGE_SEMITONES, indexToPitch, pitchLabel, pitchToIndex } from './model/pitch';

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
  dispose(): void;
}

export function createEngine(options: EngineOptions = {}): Engine {
  const audio = createAudioManager(options);
  const timer = options.timer ?? createWorkerTimer();
  const playhead = createPlayheadQueue();
  const listeners = new Set<(state: EngineState) => void>();

  let state: EngineState = createInitialState(audio.info);
  let graph: AudioGraph | null = null;
  let voice: BassVoice | null = null;
  let scheduler: Scheduler | null = null;

  const setState = (next: EngineState) => {
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const stopAudioUpdates = audio.onChange((info) => setState({ ...state, audio: info }));

  const ensureGraph = (ctx: AudioContextLike): AudioGraph => {
    graph ??= createAudioGraph(ctx, state.mix);
    return graph;
  };

  const ensureVoice = (ctx: AudioContextLike): BassVoice => {
    voice ??= createBassVoice(ctx, createBiquadFilterStage(ctx), ensureGraph(ctx).bass, state.bass);
    return voice;
  };

  const ensureScheduler = (ctx: AudioContextLike): Scheduler => {
    const bass = ensureVoice(ctx);
    scheduler ??= createScheduler({
      clock: { now: () => ctx.currentTime },
      timer,
      getTransport: () => state.transport,
      onStep: (index, time) => {
        // Le pattern et les knobs sont lus au moment de programmer : une
        // édition prend effet au plus tard une fenêtre de lookahead plus tard.
        bass.trigger(
          state.pattern.bass[index],
          time,
          stepDurationSeconds(state.transport.bpm),
          state.bass,
        );
        playhead.push({ step: index, time });
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
    const ctx = audio.context;
    if (ctx !== null) voice?.release(ctx.currentTime);
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
        case 'bass/setKnob':
        case 'bass/setWaveform':
          setState(reduce(state, command));
          voice?.applyParams(state.bass);
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
    dispose() {
      scheduler?.stop();
      timer.dispose();
      voice?.dispose();
      graph?.dispose();
      stopAudioUpdates();
      listeners.clear();
      audio.dispose();
    },
  };
}
