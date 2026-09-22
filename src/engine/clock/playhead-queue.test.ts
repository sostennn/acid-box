import { describe, expect, it } from 'vitest';
import { createPlayheadQueue } from './playhead-queue';

describe('createPlayheadQueue', () => {
  it('retourne null avant le premier pas atteint', () => {
    const queue = createPlayheadQueue();
    queue.push({ step: 0, time: 1 });
    expect(queue.audibleStep(0.5)).toBeNull();
  });

  it('retourne le dernier pas dont le temps est atteint', () => {
    const queue = createPlayheadQueue();
    queue.push({ step: 0, time: 1 });
    queue.push({ step: 1, time: 1.125 });
    queue.push({ step: 2, time: 1.25 });
    expect(queue.audibleStep(1)).toBe(0);
    expect(queue.audibleStep(1.2)).toBe(1);
    expect(queue.audibleStep(1.2)).toBe(1);
    expect(queue.audibleStep(5)).toBe(2);
  });

  it('purge les événements dépassés et garde le courant', () => {
    const queue = createPlayheadQueue();
    for (let i = 0; i < 16; i += 1) queue.push({ step: i as 0, time: i });
    expect(queue.audibleStep(10.5)).toBe(10);
    queue.push({ step: 0, time: 16 });
    expect(queue.audibleStep(10.5)).toBe(10);
    expect(queue.audibleStep(16)).toBe(0);
  });

  it('clear remet à null', () => {
    const queue = createPlayheadQueue();
    queue.push({ step: 3, time: 0 });
    expect(queue.audibleStep(1)).toBe(3);
    queue.clear();
    expect(queue.audibleStep(1)).toBeNull();
  });
});
