import { describe, expect, it } from 'vitest';
import { FakeClock, FakeTimer } from '../../../tests/fakes/fake-clock';
import type { StepIndex } from '../model/types';
import { createScheduler, type SchedulerTransport } from './scheduler';
import { stepDurationSeconds } from './timing';

interface Scheduled {
  step: StepIndex;
  time: number;
}

function setup(overrides: Partial<SchedulerTransport> = {}) {
  const clock = new FakeClock(10);
  const timer = new FakeTimer();
  const scheduled: Scheduled[] = [];
  let transport: SchedulerTransport = { bpm: 120, shuffle: 0, ...overrides };
  const scheduler = createScheduler({
    clock,
    timer,
    getTransport: () => transport,
    onStep: (step, time) => scheduled.push({ step, time }),
    intervalMs: 25,
    aheadSeconds: 0.1,
    maxLateSeconds: 0.25,
  });
  return {
    clock,
    timer,
    scheduled,
    scheduler,
    setTransport(next: Partial<SchedulerTransport>) {
      transport = { ...transport, ...next };
    },
  };
}

const DURATION_120 = stepDurationSeconds(120); // 0.125 s

describe('createScheduler', () => {
  it('programme au démarrage les pas de la fenêtre de lookahead, à partir du pas 0', () => {
    const { scheduler, scheduled, timer } = setup();
    scheduler.start(10.05);

    // Fenêtre [10, 10.1[ : seul le pas 0 (10.05) tombe dedans.
    expect(scheduled).toEqual([{ step: 0, time: 10.05 }]);
    expect(timer.running).toBe(true);
    expect(timer.intervalMs).toBe(25);
  });

  it('ne programme jamais un pas deux fois quand les fenêtres se chevauchent', () => {
    const { scheduler, scheduled, clock, timer } = setup();
    scheduler.start(10);
    for (let i = 0; i < 100; i += 1) {
      clock.advance(0.025);
      timer.tick();
    }
    const times = scheduled.map((event) => event.time);
    expect(new Set(times).size).toBe(times.length);
    expect(scheduled.map((event) => event.step).slice(0, 17)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0,
    ]);
  });

  it('rattrape les pas dus quand un réveil arrive en retard', () => {
    const { scheduler, scheduled, clock, timer } = setup();
    scheduler.start(10);
    clock.advance(0.2); // deux fois la fenêtre sans réveil
    timer.tick();
    // Tous les pas jusqu'à l'horizon 10.3 sont programmés, y compris ceux déjà passés.
    expect(scheduled.map((event) => event.time)).toEqual([10, 10.125, 10.25]);
  });

  it('saute silencieusement les pas trop en retard mais garde la position dans le pattern', () => {
    const { scheduler, scheduled, clock, timer } = setup();
    scheduler.start(10);
    const scheduledAtStart = scheduled.length;
    clock.advance(2); // onglet caché 2 s
    timer.tick();
    const afterWake = scheduled.slice(scheduledAtStart);
    expect(afterWake.length).toBeGreaterThan(0);
    expect(afterWake.every((event) => event.time >= clock.now() - 0.25)).toBe(true);
    // 2 s à 0.125 s/pas = 16 pas écoulés : la position dans le pattern est conservée.
    afterWake.forEach((event) => expect(event.step).toBe(wrapAt(event.time)));
  });

  it('n’a pas de dérive sur 1000 pas', () => {
    const { scheduler, scheduled, clock, timer } = setup();
    scheduler.start(10);
    while (scheduled.length < 1000) {
      clock.advance(0.025);
      timer.tick();
    }
    scheduled.slice(0, 1000).forEach((event, index) => {
      expect(Math.abs(event.time - (10 + index * DURATION_120))).toBeLessThan(1e-9);
    });
  });

  it('applique un changement de tempo à partir du pas suivant, sans saut de phase', () => {
    const { scheduler, scheduled, clock, timer, setTransport } = setup();
    scheduler.start(10);
    clock.advance(0.1);
    timer.tick(); // pas 0 et 1 programmés (10, 10.125) ; le pas 2 est déjà positionné à 10.25
    setTransport({ bpm: 60 });
    for (let i = 0; i < 40; i += 1) {
      clock.advance(0.025);
      timer.tick();
    }
    const times = scheduled.map((event) => event.time);
    expect(times.slice(0, 5)).toEqual([10, 10.125, 10.25, 10.5, 10.75]);
  });

  it('retarde les pas impairs avec le shuffle sans déplacer les pas pairs', () => {
    const { scheduler, scheduled, clock, timer } = setup({ shuffle: 1 });
    scheduler.start(10);
    for (let i = 0; i < 12; i += 1) {
      clock.advance(0.025);
      timer.tick();
    }
    expect(scheduled[0]?.time).toBe(10);
    expect(scheduled[1]?.time).toBeGreaterThan(10.125);
    expect(scheduled[1]?.time).toBeLessThan(10.25);
    expect(scheduled[2]?.time).toBe(10.25);
  });

  it('stop arrête le timer et start repart du pas 0', () => {
    const { scheduler, scheduled, clock, timer } = setup();
    scheduler.start(10);
    clock.advance(0.5);
    timer.tick();
    scheduler.stop();
    expect(timer.running).toBe(false);
    expect(scheduler.running).toBe(false);

    scheduled.length = 0;
    clock.time = 20;
    scheduler.start(20.05);
    expect(scheduled[0]).toEqual({ step: 0, time: 20.05 });
  });
});

function wrapAt(time: number): StepIndex {
  return (Math.round((time - 10) / DURATION_120) % 16) as StepIndex;
}
