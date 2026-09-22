/**
 * Scheduler à lookahead. À chaque réveil du timer, programme sur l'horloge
 * audio tous les pas dont le temps tombe dans la fenêtre à venir. Le tempo et
 * le shuffle sont relus à chaque pas : un changement prend effet au pas
 * suivant, sans saut de phase.
 */
import { MAX_LATE_S, SCHEDULE_AHEAD_S, SCHEDULE_INTERVAL_MS } from '../model/constants';
import type { StepIndex } from '../model/types';
import type { AudioClock, TimerSource } from './clock';
import { shuffleOffsetSeconds, stepDurationSeconds, wrapStepIndex } from './timing';

export interface SchedulerTransport {
  readonly bpm: number;
  readonly shuffle: number;
}

export interface SchedulerOptions {
  readonly clock: AudioClock;
  readonly timer: TimerSource;
  readonly getTransport: () => SchedulerTransport;
  /** Appelé pour chaque pas à programmer, avec son temps audio (shuffle inclus). */
  readonly onStep: (step: StepIndex, time: number) => void;
  readonly intervalMs?: number;
  readonly aheadSeconds?: number;
  readonly maxLateSeconds?: number;
}

export interface Scheduler {
  readonly running: boolean;
  /** Démarre au pas 0, programmé à `startTime` sur l'horloge audio. */
  start(startTime: number): void;
  stop(): void;
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  const {
    clock,
    timer,
    getTransport,
    onStep,
    intervalMs = SCHEDULE_INTERVAL_MS,
    aheadSeconds = SCHEDULE_AHEAD_S,
    maxLateSeconds = MAX_LATE_S,
  } = options;

  let running = false;
  let nextStep: StepIndex = 0;
  let nextStepTime = 0;

  const tick = () => {
    const now = clock.now();
    const horizon = now + aheadSeconds;
    while (nextStepTime < horizon) {
      const { bpm, shuffle } = getTransport();
      const duration = stepDurationSeconds(bpm);
      const tooLate = nextStepTime < now - maxLateSeconds;
      if (!tooLate) {
        onStep(nextStep, nextStepTime + shuffleOffsetSeconds(nextStep, shuffle, duration));
      }
      nextStepTime += duration;
      nextStep = wrapStepIndex(nextStep + 1);
    }
  };

  return {
    get running() {
      return running;
    },
    start(startTime) {
      if (running) return;
      running = true;
      nextStep = 0;
      nextStepTime = startTime;
      tick();
      timer.start(intervalMs, tick);
    },
    stop() {
      if (!running) return;
      running = false;
      timer.stop();
    },
  };
}
