import { describe, expect, it } from 'vitest';
import { FakeAudioContext } from '../../../tests/fakes/fake-audio-context';
import { MIN_GAIN, SCHEDULE_EPSILON_S } from '../model/constants';
import { createMetronome } from './metronome';

describe('createMetronome', () => {
  it('crée une source par frappe, démarrée et arrêtée au temps demandé', () => {
    const ctx = new FakeAudioContext();
    const metronome = createMetronome(ctx.asContext());
    metronome.trigger(0, 5);
    metronome.trigger(1, 5.125);

    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[0]?.startedAt).toBe(5);
    expect(ctx.oscillators[0]?.stoppedAt).toBeGreaterThan(5);
    expect(ctx.oscillators[1]?.startedAt).toBe(5.125);
  });

  it('accentue le premier pas par une fréquence plus haute', () => {
    const ctx = new FakeAudioContext();
    const metronome = createMetronome(ctx.asContext());
    metronome.trigger(0, 1);
    metronome.trigger(4, 2);
    const downbeat = ctx.oscillators[0]?.frequency.calls[0]?.value ?? 0;
    const beat = ctx.oscillators[1]?.frequency.calls[0]?.value ?? 0;
    expect(downbeat).toBeGreaterThan(beat);
  });

  it('ne programme jamais dans le passé ni de rampe vers zéro', () => {
    const ctx = new FakeAudioContext();
    ctx.currentTime = 10;
    const metronome = createMetronome(ctx.asContext());
    metronome.trigger(2, 9.9);

    expect(ctx.oscillators[0]?.startedAt).toBeCloseTo(10 + SCHEDULE_EPSILON_S, 10);
    const values = ctx.gains[0]?.gain.calls.map((call) => call.value) ?? [];
    expect(values.every((value) => value >= MIN_GAIN)).toBe(true);
  });

  it('libère les nœuds en fin de frappe', () => {
    const ctx = new FakeAudioContext();
    createMetronome(ctx.asContext()).trigger(0, 1);
    ctx.oscillators[0]?.emit('ended');
    expect(ctx.oscillators[0]?.connections).toHaveLength(0);
    expect(ctx.gains[0]?.connections).toHaveLength(0);
  });
});
