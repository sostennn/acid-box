import type { AudioClock, TimerSource } from '@engine/clock/clock';

export class FakeClock implements AudioClock {
  constructor(public time = 0) {}
  now() {
    return this.time;
  }
  advance(seconds: number) {
    this.time += seconds;
  }
}

/** Timer piloté à la main : `tick()` simule un réveil. */
export class FakeTimer implements TimerSource {
  intervalMs: number | null = null;
  private onTick: (() => void) | null = null;
  disposed = false;

  start(intervalMs: number, onTick: () => void) {
    this.intervalMs = intervalMs;
    this.onTick = onTick;
  }
  stop() {
    this.intervalMs = null;
    this.onTick = null;
  }
  dispose() {
    this.stop();
    this.disposed = true;
  }
  get running() {
    return this.onTick !== null;
  }
  tick() {
    this.onTick?.();
  }
}
