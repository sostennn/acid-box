import { describe, expect, it, vi } from 'vitest';
import { FakeAudioContext, createFakeVisibility } from '../../tests/fakes/fake-audio-context';
import { createEngine } from './index';
import { MIN_GAIN } from './model/constants';

function setup() {
  const ctx = new FakeAudioContext();
  const engine = createEngine({
    createContext: () => ctx.asContext(),
    visibility: createFakeVisibility(),
  });
  return { ctx, engine };
}

describe('createEngine', () => {
  it('expose l’état audio et notifie les abonnés', async () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(engine.getState().audio.availability).toBe('locked');

    await engine.unlock();
    expect(engine.getState().audio.availability).toBe('running');
    expect(listener).toHaveBeenCalledWith(engine.getState());
  });

  it('publie des snapshots immuables distincts', async () => {
    const { engine } = setup();
    const before = engine.getState();
    await engine.unlock();
    expect(engine.getState()).not.toBe(before);
    expect(before.audio.availability).toBe('locked');
  });

  it('ignore le son de test tant que l’audio est verrouillé', () => {
    const { engine, ctx } = setup();
    engine.playTestTone();
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('joue un son de test avec une source à usage unique et des rampes jamais nulles', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    ctx.currentTime = 2;
    engine.playTestTone();

    const [oscillator] = ctx.oscillators;
    const [vca] = ctx.gains;
    expect(oscillator?.startedAt).toBe(2);
    expect(oscillator?.stoppedAt).toBeGreaterThan(2);
    expect(oscillator?.connections).toContain(vca);
    expect(vca?.connections).toContain(ctx.destination);

    const rampValues = vca?.gain.calls.map((call) => call.value) ?? [];
    expect(rampValues.length).toBeGreaterThan(0);
    expect(rampValues.every((value) => value >= MIN_GAIN)).toBe(true);
  });

  it('libère les nœuds du son de test une fois terminé', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    engine.playTestTone();

    ctx.oscillators[0]?.emit('ended');
    expect(ctx.oscillators[0]?.connections).toHaveLength(0);
    expect(ctx.gains[0]?.connections).toHaveLength(0);
  });
});
